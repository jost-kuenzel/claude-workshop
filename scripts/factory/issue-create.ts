#!/usr/bin/env bun
import { Command, Options } from "@effect/cli";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Effect } from "effect";
import { runGh } from "./github";

export type IssueType = "feature" | "bug";

export function featureBody(o: { what: string; why: string; constraints?: string }): string {
  const parts = [`## What\n\n${o.what}`, `## Why\n\n${o.why}`];
  if (o.constraints?.trim()) parts.push(`## Constraints / non-goals\n\n${o.constraints}`);
  return parts.join("\n\n");
}

export function bugBody(o: { broken: string; expected: string; where: string }): string {
  return [
    `## What's broken\n\n${o.broken}`,
    `## Expected\n\n${o.expected}`,
    `## Where\n\n${o.where}`,
  ].join("\n\n");
}

export function labelsFor(type: IssueType): string[] {
  return type === "bug" ? ["factory-idea", "bug"] : ["factory-idea"];
}

export function ensureLabelArgs(label: string): string[] {
  return ["label", "create", label, "--force"];
}

export function createIssueArgs(o: { title: string; body: string; labels: string[] }): string[] {
  const labelArgs = o.labels.flatMap((l) => ["--label", l]);
  return ["issue", "create", "--title", o.title, "--body", o.body, ...labelArgs];
}

/** Ensure labels exist (idempotent), then create the issue. Returns gh stdout (URL). */
export async function createIssue(
  o: { title: string; body: string; labels: string[] },
  opts: { dryRun?: boolean } = {}
): Promise<string> {
  for (const l of o.labels) await runGh(ensureLabelArgs(l), opts);
  return runGh(createIssueArgs(o), opts);
}

const type = Options.text("type").pipe(
  Options.withDescription("feature | bug"),
  Options.withDefault("feature")
);
const title = Options.text("title");
const what = Options.text("what").pipe(
  Options.withDescription("Feature: what"),
  Options.withDefault("")
);
const why = Options.text("why").pipe(
  Options.withDescription("Feature: why"),
  Options.withDefault("")
);
const broken = Options.text("broken").pipe(
  Options.withDescription("Bug: what's broken"),
  Options.withDefault("")
);
const expected = Options.text("expected").pipe(
  Options.withDescription("Bug: expected"),
  Options.withDefault("")
);
const where = Options.text("where").pipe(
  Options.withDescription("Bug: where"),
  Options.withDefault("")
);
const dryRun = Options.boolean("dry-run").pipe(
  Options.withDescription("Skip gh writes (also enabled by FACTORY_DRY_RUN=1)"),
  Options.withDefault(process.env.FACTORY_DRY_RUN === "1")
);

const command = Command.make(
  "issue-create",
  { type, title, what, why, broken, expected, where, dryRun },
  (a) =>
    Effect.promise(() => {
      const isBug = a.type === "bug";
      const body = isBug
        ? bugBody({ broken: a.broken, expected: a.expected, where: a.where })
        : featureBody({ what: a.what, why: a.why });
      return createIssue(
        { title: a.title, body, labels: labelsFor(isBug ? "bug" : "feature") },
        { dryRun: a.dryRun }
      ).then((out) => console.log(out));
    })
);

const cli = Command.run(command, { name: "factory issue-create", version: "0.1.0" });
if (import.meta.main) {
  cli(process.argv).pipe(Effect.provide(BunContext.layer), BunRuntime.runMain);
}
