#!/usr/bin/env bun
import { Command, Options } from "@effect/cli";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Effect } from "effect";
import { runGh, runProcess } from "./lib/github";

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function specFilename(stamp: string, issue: number, slug: string): string {
  return `docs/factory/specs/${stamp}--issue-${issue}--${slug}--design.md`;
}

function yamlString(v: string): string {
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function buildFrontmatter(o: { name: string; description: string; issue: number }): string {
  return [
    "---",
    `name: ${yamlString(o.name)}`,
    `description: ${yamlString(o.description)}`,
    "status: draft",
    `issue: ${o.issue}`,
    "---",
  ].join("\n");
}

export function viewIssueArgs(issue: number): string[] {
  return ["issue", "view", String(issue), "--json", "title,body"];
}

export function issueFromSpecPath(specPath: string): number {
  const m = /--issue-(\d+)--/.exec(specPath);
  if (!m) throw new Error(`cannot find --issue-N-- in spec path: ${specPath}`);
  return Number(m[1]);
}

export function commitSpecArgs(specPath: string): {
  add: string[];
  commit: string[];
  push: string[];
} {
  const issue = issueFromSpecPath(specPath);
  return {
    add: ["add", specPath],
    commit: ["commit", "-m", `factory: spec for issue ${issue}`],
    push: ["push", "origin", "main"],
  };
}

/** Commit the spec and push to main (push is a no-op under dryRun). */
export async function commitAndPush(
  specPath: string,
  opts: { dryRun?: boolean } = {}
): Promise<void> {
  const a = commitSpecArgs(specPath);
  await runProcess("git", a.add, opts);
  await runProcess("git", a.commit, opts);
  await runProcess("git", a.push, opts);
}

export async function readIssue(issue: number, opts: { dryRun?: boolean } = {}): Promise<string> {
  return runGh(viewIssueArgs(issue), opts);
}

const issue = Options.integer("issue").pipe(
  Options.withDescription("Issue to read"),
  Options.withDefault(0)
);
const commitPath = Options.text("commit-spec").pipe(
  Options.withDescription("Spec path to commit+push to main"),
  Options.withDefault("")
);
const dryRun = Options.boolean("dry-run").pipe(
  Options.withDescription("Skip git push / gh writes (also enabled by FACTORY_DRY_RUN=1)"),
  Options.withDefault(process.env.FACTORY_DRY_RUN === "1")
);

const command = Command.make("spec-author", { issue, commitPath, dryRun }, (a) =>
  Effect.promise(async () => {
    if (a.commitPath) await commitAndPush(a.commitPath, { dryRun: a.dryRun });
    else if (a.issue > 0) console.log(await readIssue(a.issue, { dryRun: a.dryRun }));
  })
);

const cli = Command.run(command, { name: "factory spec-author", version: "0.1.0" });
if (import.meta.main) {
  cli(process.argv).pipe(Effect.provide(BunContext.layer), BunRuntime.runMain);
}
