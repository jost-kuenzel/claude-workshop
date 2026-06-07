#!/usr/bin/env bun
import { Command, Options } from "@effect/cli";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Effect } from "effect";
import { runClaude, CI_SANDBOX } from "./lib/claude";

const pr = Options.integer("pr").pipe(Options.withDescription("PR number"));
const planPath = Options.text("plan");
const runId = Options.text("run-id").pipe(Options.withDefault("local"));

export function buildFinalizePrompt(prNumber: number, plan: string): string {
  return [
    `Rewrite the body of pull request #${prNumber} to summarise the work.`,
    `Synthesise the plan at ${plan} and the branch commit log into a clear Summary`,
    "and a Test plan section. Keep the `Closes #<issue>` line if present.",
    "Edit ONLY the PR body via `gh pr edit`. Do not merge, push, or finalise the branch.",
  ].join("\n");
}

const command = Command.make("pr-finalize", { pr, planPath, runId }, (args) =>
  Effect.promise(() =>
    runClaude({
      prompt: buildFinalizePrompt(args.pr, args.planPath),
      ...CI_SANDBOX,
      maxTurns: 20,
      runId: args.runId,
      step: "pr-finalize",
    })
  ).pipe(Effect.tap(() => Effect.sync(() => console.log("pr-finalize complete"))))
);

const cli = Command.run(command, { name: "factory pr-finalize", version: "0.1.0" });
if (import.meta.main) {
  cli(process.argv).pipe(Effect.provide(BunContext.layer), BunRuntime.runMain);
}
