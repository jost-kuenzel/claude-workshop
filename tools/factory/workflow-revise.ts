#!/usr/bin/env bun
import { Command, Options } from "@effect/cli";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Effect } from "effect";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { runClaude, CI_SANDBOX } from "./lib/claude";
import { reactCommentArgs, issueCommentArgs, runGh } from "./lib/github";

const REVISE_CAP = 5;

export function nextReviseCount(current: number): number {
  return current + 1;
}

/** Current commit SHA of the checked-out worktree (trimmed). */
async function gitHead(): Promise<string> {
  const proc = Bun.spawn(["git", "rev-parse", "HEAD"], { stdout: "pipe" });
  const out = await new Response(proc.stdout).text();
  await proc.exited;
  return out.trim();
}
export function isOverCap(count: number): boolean {
  return count > REVISE_CAP;
}

const pr = Options.integer("pr").pipe(Options.withDefault(Number(process.env.PR_NUMBER)));
const commentId = Options.integer("comment-id").pipe(
  Options.withDefault(Number(process.env.COMMENT_ID ?? 0))
);
const dryRun = Options.boolean("dry-run").pipe(
  Options.withDefault(process.env.FACTORY_DRY_RUN === "1")
);
const runId = Options.text("run-id").pipe(
  Options.withDefault(process.env.GITHUB_RUN_ID ?? "local")
);

function buildRevisePrompt(prNumber: number, feedback: string): string {
  return [
    `Apply the requested revisions to PR #${prNumber} on the current branch.`,
    "",
    "Reviewer feedback to address:",
    "```",
    feedback,
    "```",
    "",
    "Make the changes, keep the tree green (the Stop hook gates `bun run lint && bun test`),",
    "and commit with a clear message. Do not push, merge, or create a PR — the pipeline",
    "owns those steps.",
  ].join("\n");
}

const command = Command.make("workflow-revise", { pr, commentId, dryRun, runId }, (args) =>
  Effect.gen(function* () {
    const dry = args.dryRun;

    // 1. react +1 on the triggering comment
    if (args.commentId) {
      yield* Effect.promise(() => runGh(reactCommentArgs(args.commentId, "+1"), { dryRun: dry }));
    }

    // 2. increment + enforce the cap
    const counterFile = `.factory/revise-count-${args.pr}.txt`;
    const current = existsSync(counterFile) ? Number(readFileSync(counterFile, "utf8")) || 0 : 0;
    const count = nextReviseCount(current);
    // `.factory/` is gitignored and absent from a fresh CI checkout; writeFileSync
    // does not create parent dirs, so create it before writing the counter file.
    if (!dry) {
      mkdirSync(".factory", { recursive: true });
      writeFileSync(counterFile, String(count));
    }
    if (isOverCap(count)) {
      yield* Effect.promise(() =>
        runGh(issueCommentArgs(args.pr, `iteration cap of ${REVISE_CAP} reached for this PR`), {
          dryRun: dry,
        })
      );
      return yield* Effect.fail(new Error("revise cap reached"));
    }

    // 3. gather unresolved review comments + the triggering comment context
    const feedback = yield* Effect.promise(() =>
      runGh(
        [
          "pr",
          "view",
          String(args.pr),
          "--json",
          "comments,reviews",
          "-q",
          '[.comments[].body, .reviews[].body] | join("\\n---\\n")',
        ],
        { dryRun: dry }
      )
    );

    // 4. invoke Claude to revise (record HEAD first so we can tell whether it committed)
    const headBefore = dry ? "" : yield* Effect.promise(gitHead);
    yield* Effect.promise(() =>
      runClaude({
        prompt: buildRevisePrompt(args.pr, feedback || "(address the latest review comments)"),
        ...CI_SANDBOX,
        maxTurns: 30,
        runId: args.runId,
        step: "revise",
        label: `Revise PR #${args.pr}`,
      })
    );

    // 5. push the new commit(s) to the PR's head branch. The checkout step put us
    //    on that named branch (not a detached HEAD), so push HEAD to it explicitly
    //    and check the result instead of swallowing failures. (Stop hook already
    //    gated lint+test during the Claude session.)
    if (!dry) {
      const headAfter = yield* Effect.promise(gitHead);
      if (headAfter === headBefore) {
        // No commit was produced — report it rather than reacting with a false success.
        yield* Effect.promise(() =>
          runGh(
            issueCommentArgs(
              args.pr,
              "factory-revise: no changes were committed, so there is nothing to push."
            )
          )
        );
        return;
      }
      const branch = (yield* Effect.promise(() =>
        runGh(["pr", "view", String(args.pr), "--json", "headRefName", "-q", ".headRefName"])
      )).trim();
      const pushOk = yield* Effect.promise(async () => {
        const proc = Bun.spawn(["git", "push", "origin", `HEAD:refs/heads/${branch}`]);
        return (await proc.exited) === 0;
      });
      if (!pushOk) {
        yield* Effect.promise(() =>
          runGh(issueCommentArgs(args.pr, "factory-revise: `git push` failed — see the run logs."))
        );
        return yield* Effect.fail(new Error("git push failed"));
      }
    }

    // 6. success reaction on the triggering comment (only after a commit landed)
    if (args.commentId) {
      yield* Effect.promise(() =>
        runGh(reactCommentArgs(args.commentId, "hooray"), { dryRun: dry })
      );
    }
  })
);

if (import.meta.main) {
  const cli = Command.run(command, { name: "factory workflow-revise", version: "0.1.0" });
  cli(process.argv).pipe(Effect.provide(BunContext.layer), BunRuntime.runMain);
}
