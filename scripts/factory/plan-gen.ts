#!/usr/bin/env bun
import { Command, Options } from "@effect/cli";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Effect } from "effect";
import { runClaude } from "./claude";

// Tool scope for plan generation: read the spec, write/commit the plan. No branch/push/PR.
const PLAN_TOOLS = [
  "Read",
  "Write",
  "Edit",
  "Grep",
  "Glob",
  "Skill",
  "Bash(bun:*)",
  "Bash(git add:*)",
  "Bash(git commit:*)",
];

const spec = Options.text("spec").pipe(Options.withDescription("Path to the committed spec file"));
const planPath = Options.text("plan").pipe(Options.withDescription("Output plan file path"));
const issue = Options.integer("issue").pipe(Options.withDescription("Issue number"));
const runId = Options.text("run-id").pipe(Options.withDefault("local"));

function buildPrompt(specPath: string, plan: string, issueNumber: number): string {
  return [
    "Use the factory-plan skill to turn the committed spec into an implementation plan.",
    "",
    `Spec: ${specPath}`,
    `Issue number: ${issueNumber}`,
    `Write the plan to: ${plan}`,
    "",
    "The plan MUST contain a `## Task Checklist` section (one `- [ ] Task <n>: <title>`",
    "line per task) as the single source of truth for task completion, followed by",
    "`### Task <n>:` detail sections. Carry `issue: <N>` and `spec: <path>` into the plan",
    "frontmatter. When done, commit the plan with message",
    `\`factory: add implementation plan for issue ${issueNumber}\`.`,
  ].join("\n");
}

export { buildPrompt, PLAN_TOOLS };

const command = Command.make("plan-gen", { spec, planPath, issue, runId }, (args) =>
  Effect.promise(() =>
    runClaude({
      prompt: buildPrompt(args.spec, args.planPath, args.issue),
      allowedTools: PLAN_TOOLS,
      maxTurns: 50,
      permissionMode: "acceptEdits",
      runId: args.runId,
      step: "plan-gen",
    })
  ).pipe(Effect.tap(() => Effect.sync(() => console.log("plan-gen complete"))))
);

const cli = Command.run(command, { name: "factory plan-gen", version: "0.1.0" });
cli(process.argv).pipe(Effect.provide(BunContext.layer), BunRuntime.runMain);
