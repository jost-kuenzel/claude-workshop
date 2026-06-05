#!/usr/bin/env bun
import { Command, Options } from "@effect/cli";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Effect, Option } from "effect";
import { runClaude } from "./lib/claude";
import { parsePlan, firstUnchecked } from "./lib/plan";

// Task steps get Agent dispatch + a local-only command surface: run tests/lint, move
// and stage files, inspect the working tree. Intentionally EXCLUDED (the pipeline owns
// the remote, and CI has no human to approve): `git push`, `gh`, `git reset --hard`,
// raw `rm`/`cp`/`mv` (use `git mv`/`git rm` + Write instead), and network tools
// (curl/wget) so an unsupervised or prompt-injected agent has nothing to exfiltrate to.
// Prefer the native Read/Grep/Glob tools over shell `cat`/`grep`/`find`.
export const TASK_TOOLS = [
  "Read",
  "Edit",
  "Write",
  "Grep",
  "Glob",
  "Skill",
  "Agent",
  // tests + lint (the canonical `npm run test` / `npm run lint`, plus the eslint the
  // agent reaches for directly)
  "Bash(bun:*)",
  "Bash(npm run:*)",
  "Bash(bunx eslint:*)",
  "Bash(npx eslint:*)",
  // local git: stage/commit, move/remove tracked files, read-only inspection
  "Bash(git add:*)",
  "Bash(git commit:*)",
  "Bash(git mv:*)",
  "Bash(git rm:*)",
  "Bash(git status:*)",
  "Bash(git diff:*)",
  "Bash(git restore:*)",
  // filesystem: create dirs + list (native Read/Grep/Glob preferred for everything else)
  "Bash(mkdir:*)",
  "Bash(ls:*)",
  // read-only text filter, so piping test/lint output through grep (e.g. `bun test | grep`)
  // doesn't trip the per-segment approval check on compound commands
  "Bash(grep:*)",
];

const planPath = Options.text("plan").pipe(Options.withDescription("Plan file path"));
const specPath = Options.text("spec").pipe(Options.withDefault(""));
const taskIndex = Options.integer("task-index").pipe(
  Options.withDescription("1-based task index; omit to take the first unchecked"),
  Options.optional
);
const runId = Options.text("run-id").pipe(Options.withDefault("local"));

export function buildTaskPrompt(opts: {
  specPath: string;
  planPath: string;
  taskNumber: number;
  taskTitle: string;
  taskBody: string;
}): string {
  return [
    "You are implementing exactly ONE task from a plan already committed to this",
    "branch. Do not loop over other tasks.",
    "",
    `Spec: ${opts.specPath}`,
    `Plan: ${opts.planPath}`,
    "Task to implement:",
    "",
    "```",
    opts.taskBody,
    "```",
    "",
    "Use the factory-implement-task skill for this single task. It dispatches the",
    "factory-implementer, factory-spec-reviewer, and factory-code-quality-reviewer",
    "agents and iterates review feedback until both reviewers approve. Those agents",
    "already enforce factory mode (single task, current branch, no worktree, no branch",
    "creation, no PR) through their own system prompts and tool allowlists, so you do",
    "not need to restate those rules.",
    "",
    "The Stop hook will gate `bun run lint && bun test`; do not bypass it.",
    "",
    "When the implementation is approved by reviewers and tests are green, edit the plan",
    `file to change \`- [ ]\` to \`- [x]\` for Task ${opts.taskNumber} in the`,
    "`## Task Checklist`, and commit that change with message",
    `\`factory: complete task ${opts.taskNumber} — ${opts.taskTitle}\`.`,
  ].join("\n");
}

const command = Command.make("task-run", { planPath, specPath, taskIndex, runId }, (args) =>
  Effect.gen(function* () {
    const markdown = yield* Effect.promise(() => Bun.file(args.planPath).text());
    const tasks = parsePlan(markdown);
    const taskIndexOpt = args.taskIndex;
    const target = Option.isSome(taskIndexOpt)
      ? tasks.find((t) => t.index === taskIndexOpt.value)
      : firstUnchecked(tasks);
    if (!target) {
      yield* Effect.sync(() => console.log("no unchecked task to run"));
      return;
    }

    yield* Effect.promise(() =>
      runClaude({
        prompt: buildTaskPrompt({
          specPath: args.specPath,
          planPath: args.planPath,
          taskNumber: target.index,
          taskTitle: target.title,
          taskBody: target.body,
        }),
        allowedTools: TASK_TOOLS,
        maxTurns: 50,
        permissionMode: "acceptEdits",
        runId: args.runId,
        step: `task-${target.index}`,
      })
    );

    // Verify the task is now checked off (the source-of-truth invariant).
    const after = parsePlan(yield* Effect.promise(() => Bun.file(args.planPath).text()));
    const stillUnchecked = after.find((t) => t.index === target.index && !t.checked);
    if (stillUnchecked) {
      yield* Effect.fail(new Error(`task ${target.index} was not checked off after the run`));
    }
    yield* Effect.sync(() => console.log(`task ${target.index} complete`));
  })
);

const cli = Command.run(command, { name: "factory task-run", version: "0.1.0" });
if (import.meta.main) {
  cli(process.argv).pipe(Effect.provide(BunContext.layer), BunRuntime.runMain);
}
