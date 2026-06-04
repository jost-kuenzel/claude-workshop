---
issue: 18
spec: docs/factory/specs/2026-06-04-1151--issue-18--move-factory-scripts-to-tools-factory--design.md
---

# Move `tools/scripts/factory` → `tools/factory` Implementation Plan

**Goal:** Relocate the factory orchestrator scripts from `tools/scripts/factory/` to
`tools/factory/` (one level shallower) and update every live reference to the old path.

**Architecture:** This is a pure relocation refactor — no behavior changes, no new code.
The directory is moved in one history-preserving `git mv`. Sibling-to-sibling imports
inside the moved sources are relative (`./github`, `./claude`, …) and resolve identically,
so they need no edits. Two kinds of code break because the path is one segment shorter:
three path-coupled lines inside the moved test files, and six external string references
in CI workflows and skill docs.

**Tech Stack:** TypeScript run under the Bun runtime (`bun test`), ESLint
(`npm run lint`), Git (`git mv`), GitHub Actions workflow YAML, Claude Code skill
Markdown.

## Task Checklist

- [x] Task 1: Relocate the directory with `git mv` and fix the three path-coupled tests
- [x] Task 2: Update the six external path references
- [x] Task 3: Final verification (tests, lint, grep)

---

### Task 1: Relocate the directory with `git mv` and fix the three path-coupled tests

Move the whole `tools/scripts/factory` subtree to `tools/factory` in one history-preserving
operation, then repair the three lines inside the moved test files that hard-code the old
depth/path. After `git mv` alone the suites `spec-author.test.ts` and `issue-create.test.ts`
fail, so the fixes belong in the same task to keep the commit green.

**Files:**

- Move (via `git mv`): `tools/scripts/factory/` → `tools/factory/` (all 10 source `.ts`
  files, the `__tests__/` subfolder with its 7 test files, and `.gitkeep`)
- Modify after move: `tools/factory/__tests__/spec-author.test.ts` (line 10)
- Modify after move: `tools/factory/__tests__/issue-create.test.ts` (lines 53 and 66)

- [ ] Step 1: move the directory in one history-preserving operation:

  ```bash
  git mv tools/scripts/factory tools/factory
  ```

- [ ] Step 2: confirm the whole subtree is staged as renames and the old path is gone:

  ```bash
  git status
  ls tools/factory
  ls tools/factory/__tests__
  ```

  Expect `tools/factory/` to hold the 10 `.ts` sources, `.gitkeep`, and `__tests__/`;
  expect `tools/scripts/factory/` to no longer exist. (`.gitkeep` is now redundant but is
  left in place to keep the move atomic and the diff minimal.)

- [ ] Step 3: run the moved suites — expect FAIL on the two path-coupled suites:

  ```bash
  bun test tools/factory/__tests__/
  ```

  `spec-author.test.ts` fails (its cross-directory import now overshoots the repo root)
  and `issue-create.test.ts` fails (its spawned-CLI path and cwd regex no longer match).

- [ ] Step 4: fix the cross-directory import in `tools/factory/__tests__/spec-author.test.ts`
      line 10. The move shortened the path by one level, so the four-`../` reach now
      overshoots the repo root and must drop one segment:

  ```ts
  // Before:
  import { validateSpecFrontmatter } from "../../../../.claude/hooks/factory-spec-frontmatter";
  // After:
  import { validateSpecFrontmatter } from "../../../.claude/hooks/factory-spec-frontmatter";
  ```

- [ ] Step 5: fix the spawned CLI path in `tools/factory/__tests__/issue-create.test.ts`
      line 53 (the string passed to `spawnSync`):

  ```ts
  // Before:
      "scripts/factory/issue-create.ts",
  // After:
      "tools/factory/issue-create.ts",
  ```

- [ ] Step 6: fix the cwd-deriving regex in `tools/factory/__tests__/issue-create.test.ts`
      line 66 so it still strips the test directory and resolves to the repo root:

  ```ts
  // Before:
    { cwd: import.meta.dir.replace(/\/scripts\/factory\/__tests__$/, ""), env: { ...process.env } }
  // After:
    { cwd: import.meta.dir.replace(/\/tools\/factory\/__tests__$/, ""), env: { ...process.env } }
  ```

- [ ] Step 7: run the moved suites again — expect all 7 PASS:

  ```bash
  bun test tools/factory/__tests__/
  ```

  Confirm `spec-author.test.ts` and `issue-create.test.ts` pass specifically.

- [ ] Step 8: commit:

  ```bash
  git add -A
  git commit -m "factory: move tools/scripts/factory to tools/factory and fix test path couplings"
  ```

---

### Task 2: Update the six external path references

Six string references in CI workflows and skill docs still point at `tools/scripts/factory`
and must become `tools/factory`. None of these are covered by tests; verify them with grep
in this task and the full gate in Task 3. (Do **not** touch
`docs/factory/factory-process-guide.md`, `docs/factory/plans/*.md`, or
`docs/factory/specs/*.md` — the guide is regenerated out of band by the `docs-factory`
skill, and the plan/spec artifacts intentionally keep the old path as a historical record.)

**Files:**

- Modify: `.github/workflows/factory-go.yml` (line 34)
- Modify: `.github/workflows/factory-revise.yml` (line 38)
- Modify: `.claude/skills/factory-issue/SKILL.md` (lines 3, 23, 24)
- Modify: `.claude/skills/factory-brainstorm/SKILL.md` (lines 20, 44, 49)
- Modify: `.claude/skills/docs-factory/SKILL.md` (line 37)

- [ ] Step 1: update `.github/workflows/factory-go.yml` line 34:

  ```yaml
  # Before:
  - run: bun tools/scripts/factory/workflow-go.ts
  # After:
  - run: bun tools/factory/workflow-go.ts
  ```

- [ ] Step 2: update `.github/workflows/factory-revise.yml` line 38:

  ```yaml
  # Before:
  - run: bun tools/scripts/factory/workflow-revise.ts
  # After:
  - run: bun tools/factory/workflow-revise.ts
  ```

- [ ] Step 3: update all three occurrences in `.claude/skills/factory-issue/SKILL.md`.
      Replace each `tools/scripts/factory` with `tools/factory`:
  - Line 3 (the `description:` frontmatter): `…files the issue via tools/scripts/factory/issue-create.ts.` → `…files the issue via tools/factory/issue-create.ts.`
  - Line 23 (Feature command): `bun tools/scripts/factory/issue-create.ts --type feature …` → `bun tools/factory/issue-create.ts --type feature …`
  - Line 24 (Bug command): `bun tools/scripts/factory/issue-create.ts --type bug …` → `bun tools/factory/issue-create.ts --type bug …`

- [ ] Step 4: update all three occurrences in `.claude/skills/factory-brainstorm/SKILL.md`.
      Replace each `tools/scripts/factory` with `tools/factory`:
  - Line 20: `run \`bun tools/scripts/factory/spec-author.ts --issue <N>\``→`run \`bun tools/factory/spec-author.ts --issue <N>\``
  - Line 44: `(\`tools/scripts/factory/spec-author.ts\`'s \`buildFrontmatter\` …)`→`(\`tools/factory/spec-author.ts\`'s \`buildFrontmatter\` …)`
  - Line 49: `\`bun tools/scripts/factory/spec-author.ts --commit-spec <spec path>\``→`\`bun tools/factory/spec-author.ts --commit-spec <spec path>\``

- [ ] Step 5: update `.claude/skills/docs-factory/SKILL.md` line 37:

  ```
  # Before:
  - **Scripts** — `tools/scripts/factory/*.ts`. Identify the orchestrators
  # After:
  - **Scripts** — `tools/factory/*.ts`. Identify the orchestrators
  ```

- [ ] Step 6: confirm no live reference to the old path remains in the workflows or skills:

  ```bash
  grep -rn "tools/scripts/factory" .github/workflows/ .claude/skills/
  ```

  Expected: no output.

- [ ] Step 7: commit:

  ```bash
  git add .github/workflows/factory-go.yml .github/workflows/factory-revise.yml \
          .claude/skills/factory-issue/SKILL.md \
          .claude/skills/factory-brainstorm/SKILL.md \
          .claude/skills/docs-factory/SKILL.md
  git commit -m "factory: repoint workflows and skills to tools/factory"
  ```

---

### Task 3: Final verification (tests, lint, grep)

The relocation gate. No files are modified here unless a check surfaces a fixup. Run the
full verification the spec requires and confirm each command is clean.

**Files:** None modified — verification only (commit a fixup only if a check fails).

- [ ] Step 1: run the moved test suites and confirm all 7 pass from the new location:

  ```bash
  bun test tools/factory/__tests__/
  ```

  Expected: 7 suites pass, including the path-coupled `spec-author.test.ts` and
  `issue-create.test.ts`.

- [ ] Step 2: run the linter and confirm it is clean (this also confirms the `__tests__/`
      ESLint location rule still matches under the new path):

  ```bash
  npm run lint
  ```

  Expected: clean, no errors.

- [ ] Step 3: confirm no live reference to the old path remains anywhere outside `docs/`
      and `node_modules`:

  ```bash
  grep -rn "scripts/factory" . --exclude-dir=node_modules --exclude-dir=docs
  ```

  Expected: **no output**. Excluding `docs/` skips the historical artifacts
  (`docs/factory/plans/*.md`, `docs/factory/specs/*.md`) that intentionally still quote the
  old path. The broader `scripts/factory` pattern (not just the `tools/`-prefixed form) is
  required because the now-fixed test couplings used the segment without the `tools/`
  prefix; grepping the prefixed form alone would give a false "clean" result. If this prints
  anything, the offending line is a missed live reference — fix it, re-run, then commit the
  fixup.

> **Out-of-band follow-up (not a checklist task):** `docs/factory/factory-process-guide.md`
> still quotes `tools/scripts/factory/*.ts`. Per the spec it is **not** hand-edited — it is
> regenerated by the `docs-factory` skill (which re-reads the live pipeline) as the final
> step, run outside the factory-implementer task flow. The grep in Step 3 deliberately
> excludes `docs/`, so this does not block verification.
