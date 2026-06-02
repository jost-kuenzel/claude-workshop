---
issue: 8
spec: docs/superpowers/specs/2026-06-02-1256--issue-8--rename-docs-factory-path--design.md
---

# Rename `docs/superpowers` → `docs/factory` Implementation Plan

## Task Checklist

- [x] Task 1: Migrate 5 artifact files to `docs/factory/`
- [x] Task 2: Fix frontmatter hook escaped regex + test fixtures
- [x] Task 3: Update `spec-author.ts` specFilename + test fixtures
- [x] Task 4: Update `workflow-go.ts` two path references
- [x] Task 5: Update `factory-brainstorm/SKILL.md` spec-path instruction
- [ ] Task 6: Verify grep check and full test suite

---

### Task 1: Migrate 5 artifact files to `docs/factory/`

**Files:**

- Create dirs: `docs/factory/specs/`, `docs/factory/plans/`
- `git mv` 5 files from `docs/superpowers/{specs,plans}/` to `docs/factory/{specs,plans}/`

- [ ] Step 1: create destination directories
  ```bash
  mkdir -p docs/factory/specs docs/factory/plans
  ```
- [ ] Step 2: move the 3 spec files
  ```bash
  git mv docs/superpowers/specs/2026-05-27-1730--ai-factory--design.md \
         docs/factory/specs/2026-05-27-1730--ai-factory--design.md
  git mv docs/superpowers/specs/2026-06-02-1020--issue-6--factory-brainstorm--design.md \
         docs/factory/specs/2026-06-02-1020--issue-6--factory-brainstorm--design.md
  git mv docs/superpowers/specs/2026-06-02-1256--issue-8--rename-docs-factory-path--design.md \
         docs/factory/specs/2026-06-02-1256--issue-8--rename-docs-factory-path--design.md
  ```
- [ ] Step 3: move the 2 plan files
  ```bash
  git mv docs/superpowers/plans/2026-06-01-1730-ai-factory.md \
         docs/factory/plans/2026-06-01-1730-ai-factory.md
  git mv docs/superpowers/plans/2026-06-02-1036--issue-6--factory-brainstorm--plan.md \
         docs/factory/plans/2026-06-02-1036--issue-6--factory-brainstorm--plan.md
  ```
- [ ] Step 4: verify 5 files are staged under `docs/factory/` and `docs/superpowers/specs/` is gone
  ```bash
  git status
  ```
- [ ] Step 5: commit
  ```bash
  git commit -m "factory: migrate artifact files from docs/superpowers to docs/factory"
  ```

> Note: `docs/superpowers/plans/` still contains the current run's plan file (tracked by the
> active factory pipeline). It will remain until this PR is merged and cleaned up manually.

---

### Task 2: Fix frontmatter hook escaped regex + test fixtures

**Files:**

- Modify: `.claude/hooks/factory-spec-frontmatter.ts` (line 8 — escaped-slash regex, highest-risk)
- Modify: `.claude/hooks/factory-spec-frontmatter.test.ts` (plain-string path fixtures)

- [ ] Step 1: update the test file first — change every `docs/superpowers/specs` fixture to `docs/factory/specs`

  In `.claude/hooks/factory-spec-frontmatter.test.ts`, the three path strings to change:
  - `"docs/superpowers/specs/2026-06-01-1200--issue-42--x--design.md"` → `"docs/factory/specs/2026-06-01-1200--issue-42--x--design.md"`
  - `"docs/superpowers/specs/x-design.md"` (three occurrences) → `"docs/factory/specs/x-design.md"`
  - The description string `"ignores files outside docs/superpowers/specs"` → `"ignores files outside docs/factory/specs"`

- [ ] Step 2: run tests — expect FAIL (old regex still rejects the new path):

  ```bash
  bun test .claude/hooks/factory-spec-frontmatter.test.ts
  ```

- [ ] Step 3: update the **escaped-slash regex** on line 8 of `.claude/hooks/factory-spec-frontmatter.ts`:

  ```ts
  // Before:
  const SPEC_GLOB = /docs\/superpowers\/specs\/.*\.md$/;
  // After:
  const SPEC_GLOB = /docs\/factory\/specs\/.*\.md$/;
  ```

- [ ] Step 4: run tests — expect PASS:

  ```bash
  bun test .claude/hooks/factory-spec-frontmatter.test.ts
  ```

- [ ] Step 5: commit
  ```bash
  git add .claude/hooks/factory-spec-frontmatter.ts .claude/hooks/factory-spec-frontmatter.test.ts
  git commit -m "factory: repoint frontmatter hook from docs/superpowers to docs/factory"
  ```

---

### Task 3: Update `spec-author.ts` specFilename + test fixtures

**Files:**

- Modify: `scripts/factory/spec-author.ts` (`specFilename` function, line 15)
- Modify: `scripts/factory/spec-author.test.ts` (plain-string path fixtures)

- [ ] Step 1: update test fixtures — change every `docs/superpowers/specs` path in
      `scripts/factory/spec-author.test.ts` to `docs/factory/specs`:
  - The expected value in the `specFilename` test: `"docs/superpowers/specs/2026-06-02-1020--issue-6--factory-brainstorm--design.md"` → `"docs/factory/specs/2026-06-02-1020--issue-6--factory-brainstorm--design.md"`
  - The `path` constant in `buildFrontmatter` test (two occurrences): `"docs/superpowers/specs/2026-06-02-1020--issue-6--x--design.md"` → `"docs/factory/specs/…"`
  - The `specPath` in `commitSpecArgs` test: `"docs/superpowers/specs/2026-06-02-1020--issue-6--factory-brainstorm--design.md"` → `"docs/factory/specs/…"`
  - All `issueFromSpecPath` test path arguments: `"docs/superpowers/specs/…"` → `"docs/factory/specs/…"`

- [ ] Step 2: run tests — expect FAIL (specFilename still returns old path):

  ```bash
  bun test scripts/factory/spec-author.test.ts
  ```

- [ ] Step 3: update `specFilename` in `scripts/factory/spec-author.ts` line 15:

  ```ts
  // Before:
  return `docs/superpowers/specs/${stamp}--issue-${issue}--${slug}--design.md`;
  // After:
  return `docs/factory/specs/${stamp}--issue-${issue}--${slug}--design.md`;
  ```

- [ ] Step 4: run tests — expect PASS:

  ```bash
  bun test scripts/factory/spec-author.test.ts
  ```

- [ ] Step 5: commit
  ```bash
  git add scripts/factory/spec-author.ts scripts/factory/spec-author.test.ts
  git commit -m "factory: repoint spec-author from docs/superpowers to docs/factory"
  ```

---

### Task 4: Update `workflow-go.ts` two path references

**Files:**

- Modify: `scripts/factory/workflow-go.ts` (line 58: specs Glob; line 83: planPath builder)

`workflow-go.test.ts` does not test these path strings (it mocks the spec list), so no test
changes are needed. The existing test suite covers the pure functions.

- [ ] Step 1: update line 58 — the specs Glob:

  ```ts
  // Before:
  for await (const f of new Glob("docs/superpowers/specs/**/*.md").scan(".")) specPaths.push(f);
  // After:
  for await (const f of new Glob("docs/factory/specs/**/*.md").scan(".")) specPaths.push(f);
  ```

- [ ] Step 2: update line 83 — the planPath builder:

  ```ts
  // Before:
  const planPath = `docs/superpowers/plans/run-${args.runId}--issue-${args.issue}--${slug}--plan.md`;
  // After:
  const planPath = `docs/factory/plans/run-${args.runId}--issue-${args.issue}--${slug}--plan.md`;
  ```

- [ ] Step 3: run tests to confirm nothing is broken:

  ```bash
  bun test scripts/factory/workflow-go.test.ts
  ```

- [ ] Step 4: commit
  ```bash
  git add scripts/factory/workflow-go.ts
  git commit -m "factory: repoint workflow-go from docs/superpowers to docs/factory"
  ```

---

### Task 5: Update `factory-brainstorm/SKILL.md` spec-path instruction

**Files:**

- Modify: `.claude/skills/factory-brainstorm/SKILL.md` (step 6 spec-path instruction)

No tests for this file; verify the change visually.

- [ ] Step 1: update step 6 in `.claude/skills/factory-brainstorm/SKILL.md`:

  ```
  // Before (in step 6):
  `docs/superpowers/specs/<stamp>--issue-<N>--<slug>--design.md`
  // After:
  `docs/factory/specs/<stamp>--issue-<N>--<slug>--design.md`
  ```

- [ ] Step 2: commit
  ```bash
  git add .claude/skills/factory-brainstorm/SKILL.md
  git commit -m "factory: repoint factory-brainstorm skill from docs/superpowers to docs/factory"
  ```

---

### Task 6: Verify grep check and full test suite

**Files:** None modified — verification only.

- [ ] Step 1: confirm no `docs/superpowers` references remain in `.claude` or `scripts`:

  ```bash
  grep -rn "docs/superpowers" .claude scripts
  ```

  Expected: no output (exit 0 with nothing printed, or exit 1 with no lines).

- [ ] Step 2: run the full test suite:

  ```bash
  bun test
  ```

  Expected: all tests pass, including `factory-spec-frontmatter.test.ts` and `spec-author.test.ts`.

- [ ] Step 3: confirm `docs/factory/specs/` contains the 3 migrated specs (including issue 8's spec)
      and `docs/factory/plans/` contains the 2 migrated plans:

  ```bash
  find docs/factory -type f | sort
  ```

- [ ] Step 4: commit verification note (if any fixup was needed); otherwise the task is done.
