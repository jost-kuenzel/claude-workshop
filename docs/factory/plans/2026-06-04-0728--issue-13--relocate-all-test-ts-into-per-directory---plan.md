---
issue: 13
spec: docs/factory/specs/2026-06-04-0913--issue-13--relocate-tests-into-tests-folders--design.md
---

# Relocate `*.test.ts` into per-directory `__tests__/` folders Implementation Plan

## Task Checklist

- [ ] Task 1: Add ESLint placement guard
- [ ] Task 2: Move `@/`-alias tests (no import changes)
- [ ] Task 3: Move `scripts/factory/` tests and fix imports
- [ ] Task 4: Move `.claude/hooks/` tests and fix imports
- [ ] Task 5: Write failing tests for `isAutomation` field (TDD)
- [ ] Task 6: Implement `isAutomation` env gate and wire Stop hook

---

### Task 1: Add ESLint placement guard

**Files:**

- Create: `eslint-rules/test-location.mjs`
- Modify: `eslint.config.mjs`

- [ ] Step 1: create `eslint-rules/test-location.mjs`:
  ```js
  export default {
    meta: { type: "problem", schema: [] },
    create(context) {
      return {
        Program() {
          if (!context.filename.split("/").includes("__tests__")) {
            context.report({
              loc: { line: 1, column: 0 },
              message: "Test files must live inside a __tests__/ folder.",
            });
          }
        },
      };
    },
  };
  ```
- [ ] Step 2: add import and rule block to `eslint.config.mjs` — add `import testLocation from "./eslint-rules/test-location.mjs";` at the top, then append this object to the exported config array:
  ```js
  {
    files: ["**/*.test.{ts,tsx}"],
    plugins: { local: { rules: { "test-location": testLocation } } },
    rules: { "local/test-location": "error" },
  }
  ```
- [ ] Step 3: run `npm run lint` — expect **FAIL** (18 test files are outside `__tests__/`)
- [ ] Step 4: run `bun test` — expect PASS (rule does not affect runtime)
- [ ] Step 5: commit `feat: add ESLint test-location placement guard`

---

### Task 2: Move `@/`-alias tests (no import changes)

**Files:**

- Modify (git mv): 9 test files from their current locations into sibling `__tests__/` folders

- [ ] Step 1: `git mv` each file (creates the `__tests__/` directory automatically on first mv per directory):
  ```
  git mv lib/utils.test.ts lib/__tests__/utils.test.ts
  git mv lib/auth.test.ts lib/__tests__/auth.test.ts
  git mv middleware.test.ts __tests__/middleware.test.ts
  git mv app/api/auth/login/route.test.ts app/api/auth/login/__tests__/route.test.ts
  git mv app/api/auth/logout/route.test.ts app/api/auth/logout/__tests__/route.test.ts
  git mv app/api/auth/me/route.test.ts app/api/auth/me/__tests__/route.test.ts
  git mv "app/api/customers/[id]/route.test.ts" "app/api/customers/[id]/__tests__/route.test.ts"
  git mv app/api/customers/route.test.ts app/api/customers/__tests__/route.test.ts
  git mv app/api/users/route.test.ts app/api/users/__tests__/route.test.ts
  ```
- [ ] Step 2: run `bun test lib/__tests__/ __tests__/ app/` — expect PASS (all `@/` imports survive the move unchanged)
- [ ] Step 3: run `npm run lint` — expect partial improvement (9 fewer errors; 9 remain for scripts/factory + hooks)
- [ ] Step 4: commit `refactor: git mv 9 @/-alias tests into __tests__/ folders`

---

### Task 3: Move `scripts/factory/` tests and fix imports

**Files:**

- Modify (git mv + edit): 7 test files under `scripts/factory/`

- [ ] Step 1: `git mv` all 7 files first (before any import edits):
  ```
  git mv scripts/factory/claude.test.ts           scripts/factory/__tests__/claude.test.ts
  git mv scripts/factory/github.test.ts           scripts/factory/__tests__/github.test.ts
  git mv scripts/factory/issue-create.test.ts     scripts/factory/__tests__/issue-create.test.ts
  git mv scripts/factory/plan.test.ts             scripts/factory/__tests__/plan.test.ts
  git mv scripts/factory/spec-author.test.ts      scripts/factory/__tests__/spec-author.test.ts
  git mv scripts/factory/workflow-go.test.ts      scripts/factory/__tests__/workflow-go.test.ts
  git mv scripts/factory/workflow-revise.test.ts  scripts/factory/__tests__/workflow-revise.test.ts
  ```
- [ ] Step 2: in each of the 6 standard files, rewrite the sibling relative import one level up — `./name` → `../name`:
  - `scripts/factory/__tests__/claude.test.ts`: `./claude` → `../claude`
  - `scripts/factory/__tests__/github.test.ts`: `./github` → `../github`
  - `scripts/factory/__tests__/issue-create.test.ts`: `./issue-create` → `../issue-create`
  - `scripts/factory/__tests__/plan.test.ts`: `./plan` → `../plan`
  - `scripts/factory/__tests__/workflow-go.test.ts`: `./workflow-go` → `../workflow-go`
  - `scripts/factory/__tests__/workflow-revise.test.ts`: `./workflow-revise` → `../workflow-revise`
- [ ] Step 3: in `scripts/factory/__tests__/spec-author.test.ts`, apply two fixes:
  - `./spec-author` → `../spec-author`
  - `../../.claude/hooks/factory-spec-frontmatter` → `../../../.claude/hooks/factory-spec-frontmatter`
- [ ] Step 4: run `bun test scripts/factory/__tests__/` — expect PASS
- [ ] Step 5: run `npm run lint` — expect only 2 remaining errors (the hooks tests still outside `__tests__/`)
- [ ] Step 6: commit `refactor: git mv 7 scripts/factory tests into __tests__/ and fix relative imports`

---

### Task 4: Move `.claude/hooks/` tests and fix imports

**Files:**

- Modify (git mv + edit): 2 test files under `.claude/hooks/`

- [ ] Step 1: `git mv` both files first (before any import edits):
  ```
  git mv .claude/hooks/factory-spec-frontmatter.test.ts .claude/hooks/__tests__/factory-spec-frontmatter.test.ts
  git mv .claude/hooks/factory-test-gate.test.ts        .claude/hooks/__tests__/factory-test-gate.test.ts
  ```
- [ ] Step 2: in `.claude/hooks/__tests__/factory-spec-frontmatter.test.ts`, rewrite:
  - `./factory-spec-frontmatter` → `../factory-spec-frontmatter`
- [ ] Step 3: in `.claude/hooks/__tests__/factory-test-gate.test.ts`, rewrite:
  - `./factory-test-gate` → `../factory-test-gate`
- [ ] Step 4: run `bun test .claude/hooks/__tests__/` — expect PASS
- [ ] Step 5: run `npm run lint` — expect **PASS** (all 18 files now inside `__tests__/`, 0 errors)
- [ ] Step 6: run `bun test` — expect PASS for all 18 tests
- [ ] Step 7: commit `refactor: git mv 2 .claude/hooks tests into __tests__/ and fix relative imports`

---

### Task 5: Write failing tests for `isAutomation` field (TDD)

**Files:**

- Modify: `.claude/hooks/__tests__/factory-test-gate.test.ts`

- [ ] Step 1: add `isAutomation: true` to every existing `decideGate(...)` call in the test file (all four existing tests), so the shape matches the coming interface change. Example — first test becomes:
  ```ts
  const d = decideGate({
    attempts: 0,
    isAutomation: true,
    stopHookActive: true,
    lintPassed: false,
    testPassed: false,
  });
  ```
- [ ] Step 2: append a new test for the `isAutomation: false` no-op:
  ```ts
  test("isAutomation false → allow immediately regardless of lint/test results", () => {
    const d = decideGate({
      attempts: 0,
      isAutomation: false,
      stopHookActive: false,
      lintPassed: false,
      testPassed: false,
    });
    expect(d).toMatchObject({ action: "allow", clearCounter: false });
    expect(d.nextAttempts).toBe(0);
  });
  ```
- [ ] Step 3: run `bun test .claude/hooks/__tests__/factory-test-gate.test.ts` — expect **FAIL** (TypeScript error: `isAutomation` does not exist on `GateInput`)
- [ ] Step 4: commit `test: add isAutomation coverage for decideGate (failing)`

---

### Task 6: Implement `isAutomation` env gate and wire Stop hook

**Files:**

- Modify: `.claude/hooks/factory-test-gate.ts`
- Modify: `.claude/settings.json`

- [ ] Step 1: add `isAutomation: boolean` to `GateInput` in `.claude/hooks/factory-test-gate.ts`:
  ```ts
  export interface GateInput {
    attempts: number;
    isAutomation: boolean;
    stopHookActive: boolean;
    lintPassed: boolean;
    testPassed: boolean;
    stderrTail?: string;
  }
  ```
- [ ] Step 2: add early-return at the top of `decideGate` (before the `stopHookActive` check):
  ```ts
  export function decideGate(input: GateInput): GateDecision {
    if (!input.isAutomation) {
      return { action: "allow", nextAttempts: input.attempts, clearCounter: false };
    }
    if (input.stopHookActive) {
  ```
- [ ] Step 3: restructure the `import.meta.main` block — add the env check as the very first action, before the counter file read and before any `run()` calls:

  ```ts
  if (import.meta.main) {
    const event = JSON.parse(await Bun.stdin.text());
    const isAutomation = process.env.GITHUB_ACTIONS === "true";
    if (!isAutomation) process.exit(0);

    const sessionId: string = event.session_id ?? "unknown";
    const counterFile = `.factory/test-gate-attempts-${sessionId}.txt`;
    const attempts = existsSync(counterFile) ? Number(readFileSync(counterFile, "utf8")) || 0 : 0;

    const lint = await run(["bun", "run", "lint"]);
    const tests = await run(["bun", "test"]);
    const stderrTail = (lint.output + "\n" + tests.output).slice(-4096);

    const decision = decideGate({
      attempts,
      isAutomation: true,
      stopHookActive: event.stop_hook_active === true,
      lintPassed: lint.ok,
      testPassed: tests.ok,
      stderrTail,
    });
    // ... rest of block unchanged (counter clear/write + exit logic)
  ```

- [ ] Step 4: run `bun test .claude/hooks/__tests__/factory-test-gate.test.ts` — expect **PASS**
- [ ] Step 5: add the `Stop` hook to `.claude/settings.json` (inside the `hooks` object, alongside `PostToolUse`):
  ```json
  "Stop": [
    {
      "hooks": [
        { "type": "command", "command": "bun .claude/hooks/factory-test-gate.ts" }
      ]
    }
  ]
  ```
- [ ] Step 6: run `npm run test` — expect PASS for all 18 tests
- [ ] Step 7: run `npm run lint` — expect PASS (clean)
- [ ] Step 8: guard proof — create a temp file `guard-probe.test.ts` at the repo root, run `npm run lint`, confirm `local/test-location` error is reported, then `git rm guard-probe.test.ts`
- [ ] Step 9: commit `feat: add isAutomation env gate to factory-test-gate and wire Stop hook`
