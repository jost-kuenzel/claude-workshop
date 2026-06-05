#!/usr/bin/env bun
import { Command, Options } from "@effect/cli";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Effect, Option } from "effect";
import { runClaude } from "./lib/claude";
import { parsePlan, firstUnchecked } from "./lib/plan";

// The task step runs under `bypassPermissions` (the no-rule-matched fallthrough is
// "allow"), so we no longer hand-maintain a treadmill of `Bash()` sub-patterns: any
// build/test/git command the agent reaches for just runs, UNLESS TASK_DENY claws it
// back. This list is therefore an advisory record of the surface the step actually
// uses; the enforced guardrail is TASK_DENY below. Prefer native Read/Grep/Glob over
// shell `cat`/`grep`/`find`.
export const TASK_TOOLS = ["Read", "Edit", "Write", "Grep", "Glob", "Skill", "Agent", "Bash"];

// Enforced denylist for the otherwise-unrestricted task step. `deny` is the
// highest-precedence bucket, so these hold even under `bypassPermissions`. They
// target the only two things an unsupervised or prompt-injected agent could do real
// damage with: network egress (exfiltration) and remote/history mutation + destructive
// fs. The orchestrator owns the remote — it pushes via `git` directly, outside Claude's
// tool surface — so the agent never legitimately needs `git push`. Read-only `gh pr`
// stays available; only the credential/repo-admin gh subcommands are denied.
export const TASK_DENY = [
  // network egress — cut the exfiltration channel
  "Bash(curl:*)",
  "Bash(wget:*)",
  "Bash(nc:*)",
  "Bash(ncat:*)",
  "Bash(telnet:*)",
  "Bash(ssh:*)",
  "Bash(scp:*)",
  "Bash(sftp:*)",
  // remote + history rewrite (the orchestrator owns the remote)
  "Bash(git push:*)",
  "Bash(git reset --hard:*)",
  // destructive fs + privilege escalation (use `git rm` / Write instead)
  "Bash(rm:*)",
  "Bash(sudo:*)",
  // credential / repo-admin gh surface
  "Bash(gh auth:*)",
  "Bash(gh secret:*)",
  "Bash(gh repo delete:*)",
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
        disallowedTools: TASK_DENY,
        maxTurns: 50,
        permissionMode: "bypassPermissions",
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
