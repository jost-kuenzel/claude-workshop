---
issue: 6
spec: docs/superpowers/specs/2026-06-02-1020--issue-6--factory-brainstorm--design.md
---

# Factory Brainstorm Implementation Plan

DRY. YAGNI. TDD. Frequent commits. Engineer has zero context: every script mirrors the
existing `scripts/factory/*` patterns — pure functions + arg-builders are unit-tested
with `bun test`; gh/git side effects go through a thin runner that honors a `dryRun`
flag (see `scripts/factory/github.ts`). Markdown artifacts (skills, agent) are verified
by lint + the existing `factory-spec-frontmatter` hook, not unit tests.

## Task Checklist

- [x] Task 1: issue-create.ts pure body + label helpers
- [x] Task 2: issue-create.ts gh arg-builders + runner + CLI
- [x] Task 3: spec-author.ts slug + filename helpers
- [ ] Task 4: spec-author.ts frontmatter + spec-path helpers
- [ ] Task 5: spec-author.ts gh-read + git commit/push runner + CLI
- [ ] Task 6: factory-issue skill
- [ ] Task 7: factory-brainstorm-reviewer agent
- [ ] Task 8: factory-brainstorm skill

---

### Task 1: issue-create.ts pure body + label helpers

Pure functions that compose lean, skimmable issue bodies (feature or bug) and pick
labels. No I/O. Mirrors the pure-function style of `scripts/factory/plan.ts`.

**Files:**

- Create: `scripts/factory/issue-create.ts`
- Test: `scripts/factory/issue-create.test.ts`

- [ ] Step 1: write failing tests in `issue-create.test.ts`:

  ```ts
  import { expect, test } from "bun:test";
  import { featureBody, bugBody, labelsFor } from "./issue-create";

  test("featureBody renders What/Why and omits empty Constraints", () => {
    const body = featureBody({ what: "Add export", why: "Users ask for CSV" });
    expect(body).toContain("## What\n\nAdd export");
    expect(body).toContain("## Why\n\nUsers ask for CSV");
    expect(body).not.toContain("## Constraints");
  });

  test("featureBody includes Constraints when provided", () => {
    const body = featureBody({ what: "a", why: "b", constraints: "no new deps" });
    expect(body).toContain("## Constraints / non-goals\n\nno new deps");
  });

  test("bugBody renders broken/expected/where", () => {
    const body = bugBody({ broken: "crashes", expected: "no crash", where: "login" });
    expect(body).toContain("## What's broken\n\ncrashes");
    expect(body).toContain("## Expected\n\nno crash");
    expect(body).toContain("## Where\n\nlogin");
  });

  test("labelsFor: feature vs bug", () => {
    expect(labelsFor("feature")).toEqual(["factory-idea"]);
    expect(labelsFor("bug")).toEqual(["factory-idea", "bug"]);
  });
  ```

- [ ] Step 2: run `bun test scripts/factory/issue-create.test.ts` — expect FAIL
- [ ] Step 3: implement the helpers in `issue-create.ts`:

  ```ts
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
  ```

- [ ] Step 4: run `bun test scripts/factory/issue-create.test.ts` — expect PASS
- [ ] Step 5: commit `factory: issue-create body + label helpers`

### Task 2: issue-create.ts gh arg-builders + runner + CLI

Add gh arg-builders, an idempotent label-ensure + create runner (reuses `runGh` from
`github.ts`), and an `@effect/cli` entry. Mirrors `plan-gen.ts` CLI shape.

**Files:**

- Modify: `scripts/factory/issue-create.ts`
- Modify: `scripts/factory/issue-create.test.ts`

- [ ] Step 1: add failing tests for the arg-builders:

  ```ts
  import { createIssueArgs, ensureLabelArgs } from "./issue-create";

  test("createIssueArgs builds gh issue create with repeated --label", () => {
    const args = createIssueArgs({ title: "T", body: "B", labels: ["factory-idea", "bug"] });
    expect(args.slice(0, 2)).toEqual(["issue", "create"]);
    expect(args).toContain("--title");
    expect(args.filter((a) => a === "--label")).toHaveLength(2);
  });

  test("ensureLabelArgs builds a gh label create", () => {
    expect(ensureLabelArgs("bug")).toEqual(["label", "create", "bug", "--force"]);
  });
  ```

- [ ] Step 2: run `bun test scripts/factory/issue-create.test.ts` — expect FAIL
- [ ] Step 3: implement arg-builders + runner + CLI:

  ```ts
  import { Command, Options } from "@effect/cli";
  import { BunContext, BunRuntime } from "@effect/platform-bun";
  import { Effect } from "effect";
  import { runGh } from "./github";

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
  ```

  Then the CLI (feature path; type defaults to feature, `--bug` switches shape):

  ```ts
  const title = Options.text("title");
  const what = Options.text("what");
  const why = Options.text("why");
  const dryRun = Options.boolean("dry-run").pipe(Options.withDefault(false));

  const command = Command.make("issue-create", { title, what, why, dryRun }, (a) =>
    Effect.promise(() =>
      createIssue(
        {
          title: a.title,
          body: featureBody({ what: a.what, why: a.why }),
          labels: labelsFor("feature"),
        },
        { dryRun: a.dryRun || process.env.FACTORY_DRY_RUN === "1" }
      ).then((out) => console.log(out))
    )
  );

  const cli = Command.run(command, { name: "factory issue-create", version: "0.1.0" });
  if (import.meta.main) {
    cli(process.argv).pipe(Effect.provide(BunContext.layer), BunRuntime.runMain);
  }
  ```

- [ ] Step 4: run `bun test scripts/factory/issue-create.test.ts` — expect PASS
- [ ] Step 5: run `bun run lint` — expect PASS
- [ ] Step 6: commit `factory: issue-create gh args, runner, CLI`

### Task 3: spec-author.ts slug + filename helpers

Pure slug + factory-naming filename helpers. No I/O.

**Files:**

- Create: `scripts/factory/spec-author.ts`
- Test: `scripts/factory/spec-author.test.ts`

- [ ] Step 1: write failing tests:

  ```ts
  import { expect, test } from "bun:test";
  import { slugify, specFilename } from "./spec-author";

  test("slugify lowercases, strips punctuation, hyphenates", () => {
    expect(slugify("Export CSV (v2)!")).toBe("export-csv-v2");
    expect(slugify("  Multiple   spaces ")).toBe("multiple-spaces");
  });

  test("specFilename follows YYYY-MM-DD-HHMM--issue-N--slug--design.md", () => {
    expect(specFilename("2026-06-02-1020", 6, "factory-brainstorm")).toBe(
      "docs/superpowers/specs/2026-06-02-1020--issue-6--factory-brainstorm--design.md"
    );
  });
  ```

- [ ] Step 2: run `bun test scripts/factory/spec-author.test.ts` — expect FAIL
- [ ] Step 3: implement:

  ```ts
  export function slugify(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  export function specFilename(stamp: string, issue: number, slug: string): string {
    return `docs/superpowers/specs/${stamp}--issue-${issue}--${slug}--design.md`;
  }
  ```

- [ ] Step 4: run `bun test scripts/factory/spec-author.test.ts` — expect PASS
- [ ] Step 5: commit `factory: spec-author slug + filename helpers`

### Task 4: spec-author.ts frontmatter + spec-path helpers

Pure frontmatter assembly. Output must satisfy `factory-spec-frontmatter.ts` (a
positive-integer `issue:` inside a leading `---` block).

**Files:**

- Modify: `scripts/factory/spec-author.ts`
- Modify: `scripts/factory/spec-author.test.ts`

- [ ] Step 1: add failing test:

  ```ts
  import { buildFrontmatter } from "./spec-author";
  import { validateSpecFrontmatter } from "../../.claude/hooks/factory-spec-frontmatter";

  test("buildFrontmatter emits a valid spec frontmatter block", () => {
    const fm = buildFrontmatter({ name: "x", description: "y", issue: 6 });
    expect(fm.startsWith("---\n")).toBe(true);
    expect(fm).toContain("issue: 6");
    const path = "docs/superpowers/specs/2026-06-02-1020--issue-6--x--design.md";
    expect(validateSpecFrontmatter(path, fm + "\n# body").ok).toBe(true);
  });
  ```

- [ ] Step 2: run `bun test scripts/factory/spec-author.test.ts` — expect FAIL
- [ ] Step 3: implement:

  ```ts
  export function buildFrontmatter(o: {
    name: string;
    description: string;
    issue: number;
  }): string {
    return [
      "---",
      `name: ${o.name}`,
      `description: ${o.description}`,
      "status: draft",
      `issue: ${o.issue}`,
      "---",
    ].join("\n");
  }
  ```

- [ ] Step 4: run `bun test scripts/factory/spec-author.test.ts` — expect PASS
- [ ] Step 5: commit `factory: spec-author frontmatter helper`

### Task 5: spec-author.ts gh-read + git commit/push runner + CLI

Read an existing issue (title/body), and commit+push a spec to `main`. gh/git go
through small arg-builders + a runner that honors `dryRun` (push becomes a no-op).
Reuses `runGh` from `github.ts`.

**Files:**

- Modify: `scripts/factory/spec-author.ts`
- Modify: `scripts/factory/spec-author.test.ts`

- [ ] Step 1: add failing tests for arg-builders:

  ```ts
  import { viewIssueArgs, commitSpecArgs } from "./spec-author";

  test("viewIssueArgs reads title+body as json", () => {
    expect(viewIssueArgs(6)).toEqual(["issue", "view", "6", "--json", "title,body"]);
  });

  test("commitSpecArgs stages just the spec path", () => {
    expect(commitSpecArgs("docs/superpowers/specs/s.md").add).toEqual([
      "add",
      "docs/superpowers/specs/s.md",
    ]);
  });
  ```

- [ ] Step 2: run `bun test scripts/factory/spec-author.test.ts` — expect FAIL
- [ ] Step 3: implement arg-builders, a git runner, and the CLI:

  ```ts
  import { Command, Options } from "@effect/cli";
  import { BunContext, BunRuntime } from "@effect/platform-bun";
  import { Effect } from "effect";
  import { runGh } from "./github";

  export function viewIssueArgs(issue: number): string[] {
    return ["issue", "view", String(issue), "--json", "title,body"];
  }

  export function commitSpecArgs(specPath: string): {
    add: string[];
    commit: string[];
    push: string[];
  } {
    return {
      add: ["add", specPath],
      commit: ["commit", "-m", `factory: spec for issue ${specPath}`],
      push: ["push", "origin", "main"],
    };
  }

  async function runGit(args: string[], opts: { dryRun?: boolean }): Promise<void> {
    if (opts.dryRun) {
      console.log(`[dry-run] git ${args.join(" ")}`);
      return;
    }
    const proc = Bun.spawn(["git", ...args], { stdout: "pipe", stderr: "pipe" });
    const [stderr, code] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
    if (code !== 0) throw new Error(`git ${args.join(" ")} failed: ${stderr.trim()}`);
  }

  /** Commit the spec and push to main (push is a no-op under dryRun). */
  export async function commitAndPush(
    specPath: string,
    opts: { dryRun?: boolean } = {}
  ): Promise<void> {
    const a = commitSpecArgs(specPath);
    await runGit(a.add, opts);
    await runGit(a.commit, opts);
    await runGit(a.push, opts);
  }

  export async function readIssue(issue: number, opts: { dryRun?: boolean } = {}): Promise<string> {
    return runGh(viewIssueArgs(issue), opts);
  }
  ```

  CLI exposes two subcommands-as-flags is overkill; expose a single `read` path for
  the skill plus a `commit` path:

  ```ts
  const issue = Options.integer("issue").pipe(Options.withDefault(0));
  const commitPath = Options.text("commit-spec").pipe(Options.withDefault(""));
  const dryRun = Options.boolean("dry-run").pipe(Options.withDefault(false));

  const command = Command.make("spec-author", { issue, commitPath, dryRun }, (a) =>
    Effect.promise(async () => {
      const dry = a.dryRun || process.env.FACTORY_DRY_RUN === "1";
      if (a.commitPath) await commitAndPush(a.commitPath, { dryRun: dry });
      else if (a.issue > 0) console.log(await readIssue(a.issue, { dryRun: dry }));
    })
  );

  const cli = Command.run(command, { name: "factory spec-author", version: "0.1.0" });
  if (import.meta.main) {
    cli(process.argv).pipe(Effect.provide(BunContext.layer), BunRuntime.runMain);
  }
  ```

- [ ] Step 4: run `bun test scripts/factory/spec-author.test.ts` — expect PASS
- [ ] Step 5: run `bun run lint` — expect PASS
- [ ] Step 6: commit `factory: spec-author gh-read, git commit/push, CLI`

### Task 6: factory-issue skill

Lightweight mini-brainstorm skill that produces a lean gh issue (feature or bug). No
unit test; verified by lint + manual dry-run.

**Files:**

- Create: `.claude/skills/factory-issue/SKILL.md`

- [ ] Step 1: write the skill with this frontmatter and shape:

  ```markdown
  ---
  name: factory-issue
  description: Use to turn a rough idea or bug report into a lean, skimmable GitHub issue for the AI factory. A mini-brainstorm — asks feature-or-bug, then a few one-at-a-time questions to nail the core, then files the issue via scripts/factory/issue-create.ts.
  ---

  # Factory Issue

  Produce ONE lean, skimmable GitHub issue. This is a mini-brainstorm, not a full design.

  ## Process

  1. Ask **feature or bug?** first.
  2. Ask a _few_ clarifying questions, ONE at a time — just enough to nail the core.
     - Feature: What / Why / (optional) Constraints.
     - Bug: What's broken / Expected / Where (repro or pointer).
  3. Keep the body short and skimmable. No essays.
  4. Create the issue:
     `bun scripts/factory/issue-create.ts --title "<title>" --what "<what>" --why "<why>"`
     (honors `FACTORY_DRY_RUN=1`). For a bug, compose the body via the bug shape.
  5. Print the returned issue number/URL.

  ## When delegated from factory-brainstorm

  If invoked with context already gathered, do NOT re-ask — compose the issue from the
  provided context and create it directly. Return the issue number to the caller.
  ```

- [ ] Step 2: run `bun run lint` — expect PASS (no TS touched, but keep the gate green)
- [ ] Step 3: commit `factory: factory-issue skill`

### Task 7: factory-brainstorm-reviewer agent

Read-only spec-document reviewer agent. Named by phase to avoid colliding with the
existing `factory-spec-reviewer` (which reviews code). Mirrors the frontmatter style of
`.claude/agents/factory-spec-reviewer.md`.

**Files:**

- Create: `.claude/agents/factory-brainstorm-reviewer.md`

- [ ] Step 1: write the agent:

  ```markdown
  ---
  name: factory-brainstorm-reviewer
  description: Read-only reviewer of a factory SPEC DOCUMENT (not code) for quality and factory-readiness. Returns approved | changes-requested with findings.
  tools: Read, Grep, Glob
  model: opus
  ---

  You review a factory spec DOCUMENT for quality and factory-readiness. You are
  read-only: you never edit. Return a verdict — `approved` or `changes-requested` —
  followed by a numbered findings list (empty if approved).

  Checklist:

  1. Placeholder scan — no TBD/TODO/vague requirements.
  2. Internal consistency — sections agree; architecture matches feature descriptions.
  3. Scope — single implementation plan, or flag that it needs decomposition.
  4. Ambiguity — flag any requirement readable two different ways.
  5. Factory-readiness — valid positive-integer `issue:` frontmatter; filename matches
     `YYYY-MM-DD-HHMM--issue-N--slug--design.md`; every requirement is concrete enough
     for factory-plan to turn into checkbox tasks.

  Be specific: cite the section and quote the problem text for each finding.
  ```

- [ ] Step 2: run `bun run lint` — expect PASS
- [ ] Step 3: commit `factory: factory-brainstorm-reviewer agent`

### Task 8: factory-brainstorm skill

The spec-authoring dialogue skill. Distilled from superpowers brainstorming; no runtime
dependency. Orchestrates: issue resolution → dialogue → design → write spec → reviewer
loop → human gate → commit+push → print hint.

**Files:**

- Create: `.claude/skills/factory-brainstorm/SKILL.md`

- [ ] Step 1: write the skill:

  ```markdown
  ---
  name: factory-brainstorm
  description: Use to turn an idea into a factory-ready spec committed to main. Guided one-question-at-a-time dialogue → 2-3 approaches → section-by-section design → spec → independent review loop → human gate → commit+push → factory-go hint. Fork-and-distilled from superpowers brainstorming; no runtime dependency.
  ---

  # Factory Brainstorm

  Turn an idea into a factory-ready spec committed to `main`. Local, interactive.
  Do NOT write code or scaffold anything — this skill ends at a committed spec.

  ## Process

  1. **Explore project context** (files, docs, recent commits).
  2. **Resolve the issue number** (required before writing the spec):
     - Given: `bun scripts/factory/spec-author.ts --issue <N>` to read the issue body
       as the starting idea.
     - Not given: invoke the `factory-issue` skill. If enough context is already
       gathered, hand it over so it creates the issue without re-asking. Get `N` back.
  3. **Clarifying dialogue** — ONE question at a time (purpose, constraints, success
     criteria). Multiple-choice when possible.
  4. **Propose 2-3 approaches** with trade-offs and a recommendation.
  5. **Present the design section-by-section**, approval after each section.
  6. **Write the spec** to the path from
     `specFilename(<stamp>, N, <slug>)`, frontmatter via `buildFrontmatter`
     (`issue: N`). The `factory-spec-frontmatter` hook validates `issue:` on write.
  7. **Review loop**: dispatch the `factory-brainstorm-reviewer` agent. If
     `changes-requested`, edit the spec per findings and re-dispatch until `approved`.
  8. **Human gate**: ask the user to review the spec; loop back on requested changes.
  9. **Commit + push**:
     `bun scripts/factory/spec-author.ts --commit-spec <spec path>`
     (honors `FACTORY_DRY_RUN=1`; push is required so factory-go can find the spec).
  10. **Print the hint**:
      `Spec on main. To start implementation: gh issue edit N --add-label factory-go`

  ## Keep / drop (vs superpowers brainstorming)

  Keep: context exploration, one-question-at-a-time dialogue, 2-3 approaches,
  section-by-section approval. Drop: the visual/browser companion.

  ## Terminal state

  This skill ends at the committed+pushed spec and the factory-go hint. Do NOT invoke
  writing-plans — the factory pipeline owns planning.
  ```

- [ ] Step 2: run `bun run lint` — expect PASS
- [ ] Step 3: commit `factory: factory-brainstorm skill`
