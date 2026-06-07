#!/usr/bin/env bun
import { Command, Options } from "@effect/cli";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Effect } from "effect";
import { Glob } from "bun";
import { runClaude, CI_SANDBOX } from "./lib/claude";
import { parsePlan, firstUnchecked } from "./lib/plan";
import { reactIssueArgs, createPrArgs, issueCommentArgs, runGh } from "./lib/github";
import { buildPrompt as buildPlanPrompt } from "./plan-gen";
import { buildTaskPrompt } from "./task-run";
import { buildFinalizePrompt } from "./pr-finalize";
import { slugify } from "./spec-author";

/** Pure: format a Date as YYYY-MM-DD-HHMM (local-time components; UTC in CI), matching `date +%Y-%m-%d-%H%M`. */
export function stampNow(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

/** Pure: build the dated plan path, mirroring `specFilename` in spec-author.ts. */
export function planFilename(stamp: string, issue: number, slug: string): string {
  return `docs/factory/plans/${stamp}--issue-${issue}--${slug}--plan.md`;
}

/** Run a git command, throwing with the captured stderr if it exits non-zero. */
async function git(...argv: string[]): Promise<void> {
  const proc = Bun.spawn(["git", ...argv], { stdout: "pipe", stderr: "pipe" });
  const [err, code] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
  if (code !== 0) throw new Error(`git ${argv.join(" ")} failed (${code}): ${err.trim()}`);
}

/** True if `branch` already exists on origin (idempotency guard for re-triggered runs). */
async function remoteBranchExists(branch: string): Promise<boolean> {
  const code = await Bun.spawn(["git", "ls-remote", "--exit-code", "--heads", "origin", branch], {
    stdout: "ignore",
    stderr: "ignore",
  }).exited;
  return code === 0;
}

/** Pure: pick the spec file whose frontmatter `issue:` equals the issue number. */
export function matchSpecForIssue(
  specs: { path: string; content: string }[],
  issue: number
): string | undefined {
  for (const s of specs) {
    const m = /^---\n([\s\S]*?)\n---/.exec(s.content);
    if (!m) continue;
    const line = m[1].split("\n").find((l) => /^issue:/.test(l.trim()));
    if (line && Number(line.split(":")[1]?.trim()) === issue) return s.path;
  }
  return undefined;
}

const issue = Options.integer("issue").pipe(Options.withDefault(Number(process.env.ISSUE_NUMBER)));
const dryRun = Options.boolean("dry-run").pipe(
  Options.withDefault(process.env.FACTORY_DRY_RUN === "1")
);
const runId = Options.text("run-id").pipe(
  Options.withDefault(process.env.GITHUB_RUN_ID ?? "local")
);

const command = Command.make("workflow-go", { issue, dryRun, runId }, (args) =>
  Effect.gen(function* () {
    const dry = args.dryRun;

    // 1. immediate +1 reaction
    yield* Effect.promise(() => runGh(reactIssueArgs(args.issue, "+1"), { dryRun: dry }));

    // 2. find the spec for this issue
    const specs = yield* Effect.promise(async () => {
      const specPaths: string[] = [];
      for await (const f of new Glob("docs/factory/specs/**/*.md").scan(".")) specPaths.push(f);
      return Promise.all(
        specPaths.map(async (p) => ({ path: p, content: await Bun.file(p).text() }))
      );
    });
    const specPath = matchSpecForIssue(specs, args.issue);
    if (!specPath) {
      yield* Effect.promise(() =>
        runGh(
          issueCommentArgs(args.issue, `no spec found with frontmatter \`issue: ${args.issue}\`.`),
          { dryRun: dry }
        )
      );
      yield* Effect.promise(() => runGh(reactIssueArgs(args.issue, "confused"), { dryRun: dry }));
      return yield* Effect.fail(new Error("no matching spec"));
    }

    // 3. issue title → slug → branch; seed commit; push
    const title = yield* Effect.promise(() =>
      runGh(["issue", "view", String(args.issue), "--json", "title", "-q", ".title"], {
        dryRun: dry,
      })
    );
    const slug = slugify(title || `issue-${args.issue}`).slice(0, 40);
    const branch = `factory/issue-${args.issue}--${slug}`;
    // Compute the stamp once so the plan path is stable for the whole run.
    const planPath = planFilename(stampNow(), args.issue, slug);

    if (!dry) {
      // Idempotency guard: if the branch already exists on origin (e.g. the
      // `factory-go` label was re-applied), resume it instead of seeding again.
      // Without this, every re-trigger appends another `seed branch` commit.
      const exists = yield* Effect.promise(() => remoteBranchExists(branch));
      if (exists) {
        yield* Effect.sync(() =>
          console.log(`branch ${branch} already exists on origin — resuming without re-seeding`)
        );
        yield* Effect.promise(async () => {
          await git("fetch", "origin", branch);
          await git("checkout", "-B", branch, `origin/${branch}`);
        });
      } else {
        yield* Effect.promise(async () => {
          await git("checkout", "-b", branch);
          await git("commit", "--allow-empty", "-m", `factory: seed branch for #${args.issue}`);
          await git("push", "-u", "origin", branch);
        });
        yield* Effect.promise(() =>
          runGh(
            createPrArgs({
              base: "main",
              head: branch,
              title: `feat: ${title}`,
              body: `Closes #${args.issue}\n\nspec: ${specPath}`,
            })
          )
        );
      }
    } else {
      yield* Effect.sync(() => console.log(`[dry-run] would create branch ${branch} and PR`));
    }

    // 4. plan generation
    yield* Effect.promise(() =>
      runClaude({
        prompt: buildPlanPrompt(specPath, planPath, args.issue),
        ...CI_SANDBOX,
        maxTurns: 50,
        runId: args.runId,
        step: "plan-gen",
        label: "Plan generation",
      })
    );
    if (!dry)
      yield* Effect.promise(async () => {
        await Bun.spawn(["git", "push"]).exited;
      });

    // 5. task loop
    let guard = 0;
    while (true) {
      if (guard++ > 100) return yield* Effect.fail(new Error("task loop guard tripped"));
      const tasks = parsePlan(yield* Effect.promise(() => Bun.file(planPath).text()));
      const target = firstUnchecked(tasks);
      if (!target) break;

      yield* Effect.promise(() =>
        runClaude({
          prompt: buildTaskPrompt({
            specPath,
            planPath,
            taskNumber: target.index,
            taskTitle: target.title,
            taskBody: target.body,
          }),
          ...CI_SANDBOX,
          maxTurns: 50,
          runId: args.runId,
          step: `task-${target.index}`,
          label: `Task ${target.index}: ${target.title}`,
        })
      );

      const after = parsePlan(yield* Effect.promise(() => Bun.file(planPath).text()));
      if (after.find((t) => t.index === target.index && !t.checked)) {
        yield* Effect.promise(() =>
          runGh(
            issueCommentArgs(
              args.issue,
              `task ${target.index} did not complete; halting the factory run.`
            ),
            { dryRun: dry }
          )
        );
        return yield* Effect.fail(new Error(`task ${target.index} did not check off`));
      }
      if (!dry)
        yield* Effect.promise(async () => {
          await Bun.spawn(["git", "push"]).exited;
        });
    }

    // 6. finalize PR body
    const prNumber = Number(
      yield* Effect.promise(() =>
        runGh(["pr", "view", branch, "--json", "number", "-q", ".number"], { dryRun: dry })
      )
    );
    if (!dry && Number.isInteger(prNumber)) {
      yield* Effect.promise(() =>
        runClaude({
          prompt: buildFinalizePrompt(prNumber, planPath),
          ...CI_SANDBOX,
          maxTurns: 20,
          runId: args.runId,
          step: "pr-finalize",
          label: "Finalize PR",
        })
      );
    }

    // 7. success reaction
    yield* Effect.promise(() => runGh(reactIssueArgs(args.issue, "hooray"), { dryRun: dry }));
  })
);

const cli = Command.run(command, { name: "factory workflow-go", version: "0.1.0" });
if (import.meta.main) {
  cli(process.argv).pipe(Effect.provide(BunContext.layer), BunRuntime.runMain);
}
