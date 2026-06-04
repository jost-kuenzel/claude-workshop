---
name: vitest-component-testing
description: Carve React component tests onto Vitest (happy-dom) while bun test keeps API/lib/middleware, remove the bun+RTL hacks left by issue #21, and get tsc --noEmit fully green.
status: draft
issue: 23
---

# Vitest for React component testing

## Context & problem

Issue #21 ("show a random Simpsons image beside the login page") was not a
testing-infrastructure task, yet to test that feature the prior session silently
made a stack of foundational decisions that were never discussed: that React
component unit tests should exist at all, that they run under `bun test`, that
the DOM comes from happy-dom's `GlobalRegistrator`, and that assertions use
`@testing-library/react` + `@testing-library/jest-dom`. Issue #23 then proposed
to _canonize_ those choices ("keep the bun test runner", "happy-dom
GlobalRegistrator wired in").

This spec reframes #23. Every problem #23 exists to fix is a symptom of
`bun test` not being a first-class environment for rendering React:

- happy-dom's `register()` overrides global `fetch`/`Request`/`Headers`, which
  breaks NextRequest cookie parsing in the API route tests — so it cannot live
  in the shared preload and each component test must opt in manually.
- `@testing-library/react`'s `screen` captures `document.body` at module-load
  time; Bun hoists static imports above the `register()` call, forcing an ugly
  `await import("@testing-library/react")` workaround (the login test documents
  that this took ~16 throwaway debug files to discover).
- jest-dom matchers are not typed for `bun:test`, so `toBeInTheDocument` /
  `toHaveAttribute` raise `tsc --noEmit` errors.
- RTL's auto-cleanup relies on a global `afterEach` Bun does not expose, so the
  test wires `afterEach(cleanup)` by hand.

Current state (verified): `bun test` → 120 pass / 0 fail (nothing is broken at
runtime), but `tsc --noEmit` reports 8 errors — 5 from the jest-dom typing in
`src/app/(auth)/login/__tests__/page.test.tsx`, plus 3 pre-existing and
unrelated (`src/lib/__tests__/auth.test.ts` `role` not assignable to `Role`;
`src/lib/__tests__/simpsons.test.ts` fetch mock missing `preconnect`).

## Goal

Move React component tests onto Vitest — the runner built for them — keep
`bun test` for everything that does not render React, delete the hack surface
left by #21, document the runner-selection rule so future sessions don't
reinvent it, and make `tsc --noEmit` fully green.

## Approach (decided)

Two scoped runners with the file extension as the boundary:

- **`bun test`** owns non-rendering tests (API routes, lib, middleware): all 120
  existing `*.test.ts`, untouched, still on the runner they already use.
- **Vitest** (happy-dom environment) owns React component tests: `*.test.tsx`
  only.

Mechanism (verified): `bun test --path-ignore-patterns '**/*.test.tsx'` makes
bun skip component tests; Vitest's `include: ["**/*.test.tsx"]` claims them. No
file is run by both.

Rejected alternatives: (B) make `bun test` + happy-dom + RTL clean — keeps the
hand-wiring (typing shim, register-ordering module, manual cleanup) as permanent
repo infrastructure against the grain of the runner; (C) drop component unit
tests and rely on E2E — removes fast component-level regression tests the repo
may want. happy-dom is chosen over jsdom for the Vitest environment because it is
already a dependency and faster, and the global-pollution problem that plagued
bun is moot here (Vitest runs in its own process, isolated from the bun suite).

## Components & changes

### New files

1. **`vitest.config.ts`**
   - Plugins: `@vitejs/plugin-react` (JSX/React transform) and
     `vite-tsconfig-paths` (resolve the `@/*` alias from `tsconfig.json`).
   - `test.environment = "happy-dom"`.
   - `test.globals = true` (exposes `expect`/`afterEach`; RTL auto-cleanup works).
   - `test.setupFiles = ["./vitest.setup.ts"]`.
   - `test.include = ["**/*.test.tsx"]`.

2. **`vitest.setup.ts`**
   - `import "@testing-library/jest-dom/vitest";` — registers the jest-dom
     matchers AND augments Vitest's types in one line (no hand-written `.d.ts`).
   - Port the `next/navigation` mock from `src/test/setup.bun.ts` using `vi.mock`
     (`useRouter` → `{ push, replace, back }` no-ops; `usePathname` → "/").

3. **`src/components/ui/__tests__/button.test.tsx`** — the copyable template.
   - Renders the existing `src/components/ui/button.tsx` (`Button`).
   - Static imports only: `render`, `screen` from `@testing-library/react`;
     `Button` from `@/components/ui/button`.
   - Asserts on rendered text and role (`button`), and renders with an explicit
     prop (e.g. `variant="secondary"`) asserting the corresponding class from
     `buttonVariants` is applied — demonstrating the common assertion patterns.
   - Doubles as real coverage; serves as the reference future component tests copy.

### Migrations

4. **`src/app/(auth)/login/__tests__/page.test.tsx`** → Vitest idioms; delete all
   four hacks:
   - Remove `import { GlobalRegistrator } ...` and `GlobalRegistrator.register()`.
   - Replace `await import("@testing-library/react")` with a normal static import.
   - Replace `mock.module(...)` with `vi.mock(...)`; the page can be imported
     statically (or via the standard Vitest mock-then-import pattern) — no DOM
     ordering workaround needed.
   - Remove the manual `afterEach(cleanup)` (Vitest + RTL handle it).
   - Preserve both existing assertions (img alt text on resolve; "D'oh!"
     placeholder + form still usable on reject).

### Cleanup

5. **`src/test/setup.bun.ts`** (bun preload) — remove the happy-dom opt-in comment
   block and the jest-dom `expect.extend(matchers as never)` line (matchers now
   live only in the Vitest setup; the `.ts` suite does not need them). Keep
   `JWT_SECRET` and the `next/navigation` mock for the bun suite.

6. **`package.json`** — remove `@happy-dom/global-registrator` from devDeps (dead
   once the login test leaves bun). Keep `happy-dom` (now the Vitest environment).
   Add `@vitejs/plugin-react`, `vite-tsconfig-paths`, and `vitest` to devDeps.

### Pre-existing tsc errors (in scope — target is fully green)

7. **`src/lib/__tests__/auth.test.ts`** — type the test payload so `role` is the
   `Role` type rather than inferred `string` (e.g. annotate the literal as
   `JwtPayload`).
8. **`src/lib/__tests__/simpsons.test.ts`** — cast the fetch mock to `typeof fetch`
   so the missing `preconnect` property no longer errors.

### Scripts (`package.json`)

(`npm run <script>` and `bun run <script>` are interchangeable here — both
resolve to the same package.json scripts; don't churn lines normalizing one to
the other.)

```jsonc
"test":            "bun test --path-ignore-patterns '**/*.test.tsx' && vitest run",
"test:unit":       "bun test --path-ignore-patterns '**/*.test.tsx'",
"test:components": "vitest run",
"test:watch":      "bun test --path-ignore-patterns '**/*.test.tsx' --watch",
"test:coverage":   "bun test --path-ignore-patterns '**/*.test.tsx' --coverage",
"typecheck":       "tsc --noEmit"
```

(`bunfig.toml`'s `[test] preload` for the bun suite is unchanged.)

### Documentation

9. **`.claude/rules/tests.md`** (new) — the substantive runner-selection rule,
   auto-loaded by Claude Code via a path glob in its frontmatter (no CLAUDE.md
   import needed):

   ```md
   ---
   paths:
     - "**/*.test.ts"
     - "**/*.test.tsx"
   ---
   ```

   Body content:
   - Component tests that render React (`*.test.tsx`) → **Vitest**
     (`bun run test:components`).
   - Everything else — API routes, lib, middleware (`*.test.ts`) → **bun test**
     (`bun run test:unit`).
   - Rule of thumb: rendering a component → `.tsx` → Vitest; no rendering →
     `.ts` → bun.
   - Note the boundary mechanism (`--path-ignore-patterns` / Vitest `include`)
     and the full script list.

   (Note: path-scoped rules are auto-discovered from `.claude/rules/` but can
   load inconsistently and do not trigger on Write-only operations per open
   Claude Code bugs — acceptable here as guidance for sessions reading test files.)

10. **`claude-workshop/CLAUDE.md`** — in the existing **Work verification**
    section, add `npm run typecheck` to the verification commands alongside
    `npm run test` and `npm run lint`. (No rules pointer needed — the rule file
    self-loads via its `paths:` frontmatter.)

## Testing & acceptance

- `bun run test:unit` → 120 pass, 0 fail (no regression; bun suite unchanged).
- `bun run test:components` → login + button tests pass under Vitest/happy-dom.
- `bun run test` → both suites run; no file executed by both runners.
- `bun run typecheck` → 0 errors (all 8 cleared, including the 3 unrelated ones).
- `bun run lint` → clean.
- The login test contains no `GlobalRegistrator`, no `await import(...)`, and no
  manual `cleanup()`.
- No remaining import of `@happy-dom/global-registrator` anywhere in the repo
  (the dep is removed and the cleanup is complete).

## Out of scope (YAGNI)

No Playwright/E2E setup. No migrating existing `*.test.ts` to Vitest. No CI
workflow wiring. No unrelated refactors beyond the two pre-existing tsc fixes.
