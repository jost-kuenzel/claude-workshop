#!/usr/bin/env bun
import { Command, Options } from "@effect/cli";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Effect } from "effect";
import { Glob } from "bun";
import { runClaude } from "./claude";
import { parsePlan, firstUnchecked } from "./plan";
import { reactIssueArgs, createPrArgs, issueCommentArgs, runGh } from "./github";
import { buildPrompt as buildPlanPrompt, PLAN_TOOLS } from "./plan-gen";
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
    const TT = [
      "Read",
      "Edit",
      "Write",
      "Grep",
      "Glob",
      "Skill",
      "Agent",
      "Bash(bun:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
    ];

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
      yield* Effect.promise(async () => {
        await Bun.spawn(["git", "checkout", "-b", branch]).exited;
        await Bun.spawn([
          "git",
          "commit",
          "--allow-empty",
          "-m",
          `factory: seed branch for #${args.issue}`,
        ]).exited;
        await Bun.spawn(["git", "push", "-u", "origin", branch]).exited;
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
    } else {
      yield* Effect.sync(() => console.log(`[dry-run] would create branch ${branch} and PR`));
    }

    // 4. plan generation
    yield* Effect.promise(() =>
      runClaude({
        prompt: buildPlanPrompt(specPath, planPath, args.issue),
        allowedTools: PLAN_TOOLS,
        maxTurns: 50,
        permissionMode: "acceptEdits",
        runId: args.runId,
        step: "plan-gen",
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
          allowedTools: TT,
          maxTurns: 50,
          permissionMode: "acceptEdits",
          runId: args.runId,
          step: `task-${target.index}`,
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
          allowedTools: ["Read", "Grep", "Glob", "Bash(git log:*)", "Bash(gh pr edit:*)"],
          maxTurns: 20,
          permissionMode: "acceptEdits",
          runId: args.runId,
          step: "pr-finalize",
        })
      );
    }

    // 7. success reaction
    yield* Effect.promise(() => runGh(reactIssueArgs(args.issue, "hooray"), { dryRun: dry }));
  })
);

const cli = Command.run(command, { name: "factory workflow-go", version: "0.1.0" });
cli(process.argv).pipe(Effect.provide(BunContext.layer), BunRuntime.runMain);
