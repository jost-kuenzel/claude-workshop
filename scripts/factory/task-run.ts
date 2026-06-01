#!/usr/bin/env bun
import { Command, Options } from "@effect/cli";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Effect, Option } from "effect";
import { runClaude } from "./claude";
import { parsePlan, firstUnchecked } from "./plan";

// Task steps get Agent dispatch + git add/commit, but NEVER branch/worktree/push/PR.
const TASK_TOOLS = [
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
cli(process.argv).pipe(Effect.provide(BunContext.layer), BunRuntime.runMain);
