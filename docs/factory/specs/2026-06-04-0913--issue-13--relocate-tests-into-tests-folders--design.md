---
name: relocate-tests-into-tests-folders
description: Move all 18 *.test.ts files into per-directory __tests__/ folders, fix relative imports, add a custom ESLint placement guard, and wire an env-gated CI-only Stop hook that verifies lint+tests.
status: draft
issue: 13
---

# Relocate `*.test.ts` into per-directory `__tests__/` folders + placement guard

## Goal

Standardize all test placement on the `__tests__/` convention — a sibling folder
within each source directory (Jest convention) — so tests stay close to the code
they cover while sitting in a single, recognized location. Add a **deterministic
guard** that prevents drift back to colocated tests, and ensure that guard (plus
the full test suite) is enforced automatically when Claude runs autonomously in
GitHub Actions, without getting in the way of local interactive sessions.

## Background

- Runner is `bun test`, which auto-discovers `*.test.ts` anywhere — **no runner
  config change is needed**. `bunfig.toml` preloads `./test/setup.bun.ts`; that
  `test/` directory holds shared helpers (`db-helpers.ts`, `request-helpers.ts`,
  `setup.bun.ts`), is **not** a `*.test.ts` location, and stays exactly where it is.
- There are **18** `*.test.ts` files today (the issue says 17 — a minor undercount;
  the two `.claude/hooks/` tests are explicitly in scope per the issue body).
- Imports split into two kinds: `@/`-alias imports (path-independent, survive the
  move untouched) and **relative** imports (`./x`), which break when the test moves
  one level deeper into `__tests__/` and must be rewritten.
- The repo already contains a fully built, unit-tested Stop hook,
  `.claude/hooks/factory-test-gate.ts`, that runs `bun run lint` + `bun test` and
  exits `2` to block stop and feed failures back to Claude (up to 3 attempts).
  **It is not wired into `.claude/settings.json`** — today only two `PostToolUse`
  hooks are registered, and no `Stop` hook is active.

## Scope: file inventory & moves

All 18 files move into a `__tests__/` sibling folder in their current directory.
Use `git mv` per file (preserves history), then apply the targeted import fixes
below. **Ordering matters: move each file into `__tests__/` _before_ editing its
imports.** The `lint-fix` PostToolUse hook runs `eslint --fix` on every edited
file, and the new placement rule errors on any `*.test.ts` outside `__tests__/`;
moving first guarantees the file is already in a valid location when it is edited.

| From                                             | To                                                         | Import fix?       |
| ------------------------------------------------ | ---------------------------------------------------------- | ----------------- |
| `lib/utils.test.ts`                              | `lib/__tests__/utils.test.ts`                              | No (`@/` alias)   |
| `lib/auth.test.ts`                               | `lib/__tests__/auth.test.ts`                               | No (`@/` alias)   |
| `app/api/auth/login/route.test.ts`               | `app/api/auth/login/__tests__/route.test.ts`               | No (`@/` alias)   |
| `app/api/auth/logout/route.test.ts`              | `app/api/auth/logout/__tests__/route.test.ts`              | No (`@/` alias)   |
| `app/api/auth/me/route.test.ts`                  | `app/api/auth/me/__tests__/route.test.ts`                  | No (`@/` alias)   |
| `app/api/customers/[id]/route.test.ts`           | `app/api/customers/[id]/__tests__/route.test.ts`           | No (`@/` alias)   |
| `app/api/customers/route.test.ts`                | `app/api/customers/__tests__/route.test.ts`                | No (`@/` alias)   |
| `app/api/users/route.test.ts`                    | `app/api/users/__tests__/route.test.ts`                    | No (`@/` alias)   |
| `middleware.test.ts`                             | `__tests__/middleware.test.ts` (repo root)                 | No (`@/` alias)   |
| `scripts/factory/claude.test.ts`                 | `scripts/factory/__tests__/claude.test.ts`                 | **Yes**           |
| `scripts/factory/github.test.ts`                 | `scripts/factory/__tests__/github.test.ts`                 | **Yes**           |
| `scripts/factory/issue-create.test.ts`           | `scripts/factory/__tests__/issue-create.test.ts`           | **Yes**           |
| `scripts/factory/plan.test.ts`                   | `scripts/factory/__tests__/plan.test.ts`                   | **Yes**           |
| `scripts/factory/spec-author.test.ts`            | `scripts/factory/__tests__/spec-author.test.ts`            | **Yes (special)** |
| `scripts/factory/workflow-go.test.ts`            | `scripts/factory/__tests__/workflow-go.test.ts`            | **Yes**           |
| `scripts/factory/workflow-revise.test.ts`        | `scripts/factory/__tests__/workflow-revise.test.ts`        | **Yes**           |
| `.claude/hooks/factory-spec-frontmatter.test.ts` | `.claude/hooks/__tests__/factory-spec-frontmatter.test.ts` | **Yes**           |
| `.claude/hooks/factory-test-gate.test.ts`        | `.claude/hooks/__tests__/factory-test-gate.test.ts`        | **Yes**           |

## Import fixes

Only the relative-import tests change; the `@/`-alias tests (all of `app/`,
`lib/`, and root `middleware.test.ts`) need no edits.

- **All `scripts/factory/__tests__/*` and `.claude/hooks/__tests__/*` tests:**
  rewrite each sibling relative import one level up — `./name` → `../name`.
  Affected specifiers, by file:
  - `claude.test.ts`: `./claude` → `../claude`
  - `github.test.ts`: `./github` → `../github`
  - `issue-create.test.ts`: `./issue-create` → `../issue-create`
  - `plan.test.ts`: `./plan` → `../plan`
  - `workflow-go.test.ts`: `./workflow-go` → `../workflow-go`
  - `workflow-revise.test.ts`: `./workflow-revise` → `../workflow-revise`
  - `factory-spec-frontmatter.test.ts`: `./factory-spec-frontmatter` → `../factory-spec-frontmatter`
  - `factory-test-gate.test.ts`: `./factory-test-gate` → `../factory-test-gate`
- **Special case — `scripts/factory/__tests__/spec-author.test.ts`** has two
  relative imports:
  - `./spec-author` → `../spec-author`
  - `../../.claude/hooks/factory-spec-frontmatter` →
    `../../../.claude/hooks/factory-spec-frontmatter` (one level deeper).

## ESLint placement rule (the guard)

The guard is a custom ESLint rule (chosen over bun-test/standalone-script because
it rides the existing `npm run lint` path and the `lint-fix` PostToolUse hook).

- **New file `eslint-rules/test-location.mjs`** — a custom rule that reports any
  linted file whose path does not contain a `__tests__/` segment. Logic:
  `context.filename.split('/').includes('__tests__')` (path-segment check, so the
  `app/api/customers/[id]/` bracket dir is matched as a literal, not a glob).
- **Wire into `eslint.config.mjs`** as a local plugin, scoped to test files:
  ```js
  import testLocation from "./eslint-rules/test-location.mjs";
  // ...
  {
    files: ["**/*.test.{ts,tsx}"],
    plugins: { local: { rules: { "test-location": testLocation } } },
    rules: { "local/test-location": "error" },
  }
  ```
- **Rule is report-only** — it sets no `fix`/`meta.fixable`, so `eslint --fix`
  (used by the `lint-fix` PostToolUse hook) never silently moves a file; a
  misplaced test surfaces as an error the implementer must resolve by relocating.
- **Coverage is full (empirically verified, not assumed):** ESLint **v9.39.4**
  flat config default-ignores only `**/node_modules/` and `.git/` — it does **not**
  ignore dot-directories (that was eslintrc-era behavior). Confirmed via
  `bunx eslint --debug`: the no-arg run (what `npm run lint` executes) lints
  `app/`, `lib/`, `scripts/`, the dot-directory `.claude/hooks/`, the repo root,
  **and** a freshly-created nested `.claude/hooks/__tests__/` file — all 18 test
  locations are covered, so a misplaced `*.test.ts` anywhere is caught. If a future
  config change ever narrows traversal away from `.claude/`, an explicit `files`
  entry covering `.claude/**` must be added to preserve coverage.

## Stop hook: env-gate + wiring (CI-only enforcement)

Goal: the placement guard (and the full suite) must run and feed failures back when
Claude runs autonomously in GitHub Actions, but the gate must **not** fire during
local interactive/factory-skill sessions.

Constraint confirmed from Claude Code docs: **hooks do not merge across settings
sources** — a higher-precedence source replaces the entire per-event array. So a
`--settings` file or `settings.local.json` would force duplicating the existing
PostToolUse hooks. The clean approach is a single registration in the shared
settings, **env-gated inside the hook**.

- **`decideGate` gains an `isAutomation: boolean`** field on `GateInput`. When
  `isAutomation` is `false`, `decideGate` returns
  `{ action: "allow", nextAttempts: input.attempts, clearCounter: false }`
  immediately (a no-op), before any lint/test consideration. This keeps the gating
  decision **pure and unit-testable**.
- **I/O shell restructure** (`import.meta.main` block) — concrete control flow,
  since today the block runs lint+tests _unconditionally_ (current lines ~57-59
  call `run(["bun","run","lint"])` and `run(["bun","test"])` before building the
  `decideGate` input). It must become:
  1. Read `const isAutomation = process.env.GITHUB_ACTIONS === "true";` first.
  2. **If `!isAutomation`, `process.exit(0)` immediately** — before reading the
     counter file and before either `run(...)` spawn. (Equivalently, call
     `decideGate({ isAutomation: false, ... })` and exit on its `allow`.) The
     point: **no `bun run lint` / `bun test` may run on a local Stop.**
  3. Only when `isAutomation` is true: read the counter file, run lint + tests,
     build the `GateInput` (now including `isAutomation: true`), call `decideGate`,
     and apply the existing counter-clear / write / `exit(2)`-on-block logic
     unchanged.
     GitHub Actions always exports `GITHUB_ACTIONS=true`; local sessions don't.
     `runClaude`'s `resolveAuthEnv` already forwards `process.env` to the `claude`
     subprocess, so the var reaches the hook in CI.
- **Register the Stop hook** in `.claude/settings.json` under a new `Stop` event
  (Stop hooks take no `matcher`):
  ```json
  "Stop": [
    { "hooks": [
      { "type": "command", "command": "bun .claude/hooks/factory-test-gate.ts" }
    ]}
  ]
  ```
- **Update `factory-test-gate.test.ts`** (now at
  `.claude/hooks/__tests__/factory-test-gate.test.ts`) to cover the new
  `isAutomation` field: `isAutomation: false` → `allow`/no-op regardless of
  lint/test results; `isAutomation: true` preserves the existing block/allow/retry
  semantics.

Net effect: locally the gate exits `0` immediately and never interrupts work; in
the `factory-go`/`factory-revise` workflows it runs `bun run lint` (including the
new placement rule) and `bun test`, blocking finish with feedback up to 3 attempts.

## Edge cases / risks (addressed)

- **Next.js `app/` routing:** `__tests__` begins with `_`, so Next treats it as a
  **private folder** and excludes it from routing — safe, and stricter than today's
  colocated `route.test.ts` files (which already pass).
- **`bun test` discovery:** auto-discovers `*.test.ts` at any depth; the
  `bunfig.toml` preload (`./test/setup.bun.ts`) is unaffected — the `test/` helpers
  dir is distinct from `__tests__/` and is not moved.
- **Helpers** (`test/db-helpers.ts`, `test/request-helpers.ts`,
  `test/setup.bun.ts`): not `*.test.ts`, so untouched by the rule and not relocated.
- **`[id]` dynamic-segment dir:** handled by the path-segment check, not a glob, so
  the bracket characters cause no false negative.

## Verification

- `npm run test` — all 18 relocated tests pass.
- `npm run lint` — clean.
- **Guard proof:** temporarily add a colocated `*.test.ts` outside any `__tests__/`
  folder, confirm `npm run lint` reports the `local/test-location` error, then
  remove it.
- **Hook proof:** `decideGate` unit tests cover `isAutomation: false` (no-op) and
  `isAutomation: true` (existing semantics); confirm the hook exits `0` locally
  (no `GITHUB_ACTIONS`).

## Non-goals

- No `bun test` runner / `bunfig.toml` config change.
- No relocation of the `test/` helpers directory.
- No CI workflow for arbitrary human pushes/PRs — enforcement is the autonomous,
  env-gated Stop hook.
- No central single `__tests__/` directory — placement is per source directory.
