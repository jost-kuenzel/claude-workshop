---
issue: 23
spec: docs/factory/specs/2026-06-04-1658--issue-23--vitest-component-testing--design.md
---

# Vitest Component Testing — Implementation Plan

**Goal:** Move React component tests from `bun test` to Vitest so every bun-specific hack (GlobalRegistrator, dynamic imports, jest-dom type shim, manual cleanup) can be deleted, and make `tsc --noEmit` fully green.

**Architecture:** Two non-overlapping test runners share the repo: `bun test` owns all `*.test.ts` files (API routes, lib, middleware — no DOM needed); Vitest owns all `*.test.tsx` files (React component tests — happy-dom environment). The boundary is enforced by a `--path-ignore-patterns '**/*.test.tsx'` flag on the bun command and an `include: ["**/*.test.tsx"]` filter in `vitest.config.ts`, so no file runs under both runners. `vitest.setup.ts` registers jest-dom matchers via `import "@testing-library/jest-dom/vitest"` and mocks `next/navigation` via `vi.mock` — eliminating the hand-rolled typing shim and the per-file `GlobalRegistrator.register()` call that the bun approach required.

**Tech Stack:** Next.js 16 / React 19, Bun (package manager + `*.test.ts` runner), Vitest 3 (`*.test.tsx` runner), `@vitejs/plugin-react` (JSX transform), `vite-tsconfig-paths` (`@/*` alias), `happy-dom` (DOM environment, already a dep), `@testing-library/react` v16, `@testing-library/jest-dom` v6.

## Task Checklist

- [x] Task 1: Install Vitest deps, create vitest.config.ts and vitest.setup.ts, add helper scripts
- [ ] Task 2: Create Button component test as the Vitest template
- [ ] Task 3: Migrate login page test to Vitest idioms
- [ ] Task 4: Update bun scripts, clean up preload, remove @happy-dom/global-registrator
- [ ] Task 5: Fix pre-existing tsc errors in auth.test.ts and simpsons.test.ts
- [ ] Task 6: Add runner-selection rule and update CLAUDE.md

---

### Task 1: Install Vitest deps, create vitest.config.ts and vitest.setup.ts, add helper scripts

**Files:**

- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`

**Context for this task:** The repo currently uses `bun test` for everything. This task adds Vitest as a second runner for `*.test.tsx` files only. The existing `test`, `test:watch`, and `test:coverage` scripts are left unchanged here — they are updated in Task 4 after the login test is migrated. Only new scripts (`test:components`, `test:unit`, `typecheck`) are added.

- [ ] Step 1: Install the three new dev dependencies:

  ```bash
  bun add -D vitest @vitejs/plugin-react vite-tsconfig-paths
  ```

  This adds entries to `devDependencies` in `package.json` and updates `bun.lock`. Do not modify any other part of `package.json` in this step.

- [ ] Step 2: Create `vitest.config.ts` at the repo root with this exact content:

  ```ts
  import { defineConfig } from "vitest/config";
  import react from "@vitejs/plugin-react";
  import tsconfigPaths from "vite-tsconfig-paths";

  export default defineConfig({
    plugins: [react(), tsconfigPaths()],
    test: {
      environment: "happy-dom",
      globals: true,
      setupFiles: ["./vitest.setup.ts"],
      include: ["**/*.test.tsx"],
    },
  });
  ```

  - `tsconfigPaths()` resolves the `@/*` alias declared in `tsconfig.json` so `@/components/...` imports work inside component tests.
  - `globals: true` exposes `describe`, `it`, `expect`, `afterEach`, etc. as globals — no per-file `import { describe } from "vitest"` needed (only `vi` must be imported explicitly).
  - `include: ["**/*.test.tsx"]` keeps Vitest from touching `*.test.ts` files.

- [ ] Step 3: Create `vitest.setup.ts` at the repo root with this exact content:

  ```ts
  import "@testing-library/jest-dom/vitest";
  import { vi } from "vitest";

  vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }),
    usePathname: () => "/",
  }));
  ```

  - `import "@testing-library/jest-dom/vitest"` registers all RTL matchers (`.toBeInTheDocument()`, `.toHaveAttribute()`, etc.) **and** augments Vitest's TypeScript types in one import — no hand-written `.d.ts` file needed.
  - The `vi.mock("next/navigation", ...)` call is automatically hoisted by Vitest to before any component import, so every `*.test.tsx` file gets the mock without any per-file setup. This is the same mock currently in `src/test/setup.bun.ts`.

- [ ] Step 4: Add three new scripts to the `"scripts"` block in `package.json`. Do not change the existing `test`, `test:watch`, or `test:coverage` entries — those are updated in Task 4.

  Add after the existing `"test:coverage"` line:

  ```jsonc
  "test:unit":       "bun test --path-ignore-patterns '**/*.test.tsx'",
  "test:components": "vitest run",
  "typecheck":       "tsc --noEmit"
  ```

- [ ] Step 5: Run `bun run test:components`. With no `*.test.tsx` files that can run under Vitest yet (the login test still uses bun APIs), this command should exit cleanly — Vitest will report "no test files found" or "0 tests passed". It must not crash.

  If it errors with a plugin or config problem, check `vitest.config.ts` for typos and re-run.

- [ ] Step 6: Run `bun run test:unit`. This runs `bun test --path-ignore-patterns '**/*.test.tsx'` — the existing 120 `*.test.ts` tests pass, and the login test (`*.test.tsx`) is excluded. Expect: **120 pass, 0 fail**.

- [ ] Step 7: Run `npm run lint` — fix any issues, re-run to confirm clean.

- [ ] Step 8: Commit:

  ```
  feat(test): install Vitest, add vitest.config.ts + vitest.setup.ts
  ```

---

### Task 2: Create Button component test as the Vitest template

**Files:**

- Create: `src/components/ui/__tests__/button.test.tsx`

**Context for this task:** Vitest is already configured (Task 1). The `test:components` script runs `vitest run` which picks up every `*.test.tsx` file. The repo has `src/components/ui/button.tsx` which exports `Button` (a `<button>` element wrapper) and `buttonVariants` (a `cva` helper that maps variant prop values to Tailwind classes). The `secondary` variant maps to the class `bg-secondary`.

This test is the canonical copy-paste template for future component tests: static imports, Vitest globals (`describe`, `it`, `expect`), jest-dom matchers (already registered by `vitest.setup.ts`), and no explicit setup/teardown (RTL auto-cleanup is wired by `vitest.setup.ts` globals).

- [ ] Step 1: Create the directory `src/components/ui/__tests__/` if it doesn't exist, then create `src/components/ui/__tests__/button.test.tsx` with this content:

  ```tsx
  import { render, screen } from "@testing-library/react";
  import { Button, buttonVariants } from "@/components/ui/button";

  describe("Button", () => {
    it("renders with the correct role and text", () => {
      render(<Button>Click me</Button>);
      const btn = screen.getByRole("button", { name: "Click me" });
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveTextContent("Click me");
    });

    it("applies the secondary variant class when variant='secondary'", () => {
      render(<Button variant="secondary">Secondary</Button>);
      const btn = screen.getByRole("button", { name: "Secondary" });
      // buttonVariants({ variant: "secondary" }) includes "bg-secondary"
      expect(btn.className).toContain("bg-secondary");
    });
  });
  ```

  No React import is needed — `@vitejs/plugin-react` handles the JSX transform automatically.

- [ ] Step 2: Run `bun run test:components`. Expect: **2 pass, 0 fail** (both button tests green).

  If you see `Cannot find module '@/components/ui/button'`, check that `vite-tsconfig-paths` is listed in `vitest.config.ts` plugins and re-run. If you see `toBeInTheDocument is not a function`, check that `vitest.setup.ts` exists at the repo root and is referenced in `vitest.config.ts` `setupFiles`.

- [ ] Step 3: Run `npm run lint` — fix any issues, re-run to confirm clean.

- [ ] Step 4: Commit:

  ```
  feat(test): add Button component test (Vitest template)
  ```

---

### Task 3: Migrate login page test to Vitest idioms

**Files:**

- Modify: `src/app/(auth)/login/__tests__/page.test.tsx`

**Context for this task:** The existing `page.test.tsx` runs under `bun test` and contains four bun-specific hacks that must be deleted: (1) `GlobalRegistrator.register()` for the DOM, (2) `await import("@testing-library/react")` workaround to control import ordering, (3) `mock.module(...)` for mocking, and (4) `afterEach(cleanup)` for manual RTL teardown. Under Vitest none of these are needed: happy-dom is the environment, static imports work because `vi.mock` is hoisted by Vitest above all imports, and RTL auto-cleanup is handled by Vitest globals.

The two test assertions must be preserved exactly: (a) image renders with alt text equal to the character name on resolve; (b) "D'oh!" placeholder text is visible and form fields remain usable on reject.

- [ ] Step 1: Replace the entire contents of `src/app/(auth)/login/__tests__/page.test.tsx` with:

  ```tsx
  import { vi } from "vitest";
  import { render, screen, waitFor } from "@testing-library/react";
  import LoginPage from "@/app/(auth)/login/page";

  type SimpsonsCharacter = { imageUrl: string; name: string };

  let mockGetCharacter: (signal?: AbortSignal) => Promise<SimpsonsCharacter> = () =>
    Promise.reject(new Error("not set"));

  vi.mock("@/lib/simpsons", () => ({
    getRandomSimpsonsCharacter: (signal?: AbortSignal) => mockGetCharacter(signal),
  }));

  describe("LoginPage — Simpsons image panel", () => {
    it("renders an img with the character name as alt text when fetch resolves", async () => {
      mockGetCharacter = () =>
        Promise.resolve({
          imageUrl: "https://cdn.thesimpsonsapi.com/500/homer.png",
          name: "Homer Simpson",
        });

      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getByRole("img")).toHaveAttribute("alt", "Homer Simpson");
      });
    });

    it("shows D'oh! placeholder and keeps form usable when fetch rejects", async () => {
      mockGetCharacter = () => Promise.reject(new Error("blocked"));

      render(<LoginPage />);

      await waitFor(() => {
        expect(screen.getByText("D'oh!")).toBeInTheDocument();
      });

      expect(screen.getByLabelText("Email")).toBeInTheDocument();
      expect(screen.getByLabelText("Password")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    });
  });
  ```

  Key differences from the bun version:
  - No `GlobalRegistrator` import or `register()` call — Vitest runs in happy-dom automatically.
  - Static `import LoginPage from "@/app/(auth)/login/page"` — works because Vitest hoists `vi.mock` above all imports before executing the module, so the mock is in place when LoginPage is loaded.
  - `vi.mock(...)` replaces `mock.module(...)` — same semantics, Vitest-native.
  - No `afterEach(cleanup)` — Vitest global mode + RTL handles cleanup automatically.
  - `describe`/`it`/`expect` are available as globals from `test.globals: true` in `vitest.config.ts`.

- [ ] Step 2: Run `bun run test:components`. Expect: **4 pass, 0 fail** (2 button tests + 2 login tests).

  If you see `vi is not defined`, add `import { vi } from "vitest"` at the top of the file (it should already be there from Step 1). If you see mock-not-applied errors, ensure `vi.mock` is at the module top-level (not inside a `describe` or `beforeEach`).

- [ ] Step 3: Run `npm run lint` — fix any issues, re-run to confirm clean.

- [ ] Step 4: Commit:

  ```
  refactor(test): migrate login test to Vitest — remove all bun hacks
  ```

---

### Task 4: Update bun scripts, clean up bun preload, remove @happy-dom/global-registrator

**Files:**

- Modify: `package.json`
- Modify: `src/test/setup.bun.ts`

**Context for this task:** The login test now runs under Vitest (Task 3), so `bun test` must be told to skip `*.test.tsx` files. The jest-dom matchers (`expect.extend(matchers)`) and the happy-dom comment in `src/test/setup.bun.ts` are no longer needed for the bun suite — the `*.test.ts` files don't use RTL matchers and never needed DOM. `@happy-dom/global-registrator` is now an unused dependency and should be removed. The three existing scripts (`test`, `test:watch`, `test:coverage`) need the `--path-ignore-patterns '**/*.test.tsx'` flag, and `test` should chain with `&& vitest run`.

- [ ] Step 1: Open `package.json` and update the three existing test scripts. Change:

  ```json
  "test": "bun test",
  "test:watch": "bun test --watch",
  "test:coverage": "bun test --coverage"
  ```

  To:

  ```json
  "test": "bun test --path-ignore-patterns '**/*.test.tsx' && vitest run",
  "test:watch": "bun test --path-ignore-patterns '**/*.test.tsx' --watch",
  "test:coverage": "bun test --path-ignore-patterns '**/*.test.tsx' --coverage"
  ```

  Also remove `@happy-dom/global-registrator` from `devDependencies` entirely (the key `"@happy-dom/global-registrator": "^20.9.0"` should be deleted). `happy-dom` (without the registrator package) stays — it is the Vitest environment.

- [ ] Step 2: Run `bun install` to sync the lockfile after removing the dependency.

- [ ] Step 3: Open `src/test/setup.bun.ts`. The current file looks like:

  ```ts
  import { expect, mock } from "bun:test";
  import * as matchers from "@testing-library/jest-dom/matchers";

  // happy-dom's GlobalRegistrator.register() is intentionally NOT called here.
  // It overrides fetch/Request/Headers globals, which breaks NextRequest cookie
  // parsing for API route tests. Component tests (none yet) that need a DOM
  // should opt in by importing and calling GlobalRegistrator.register() in
  // their own setup or at the top of the file.
  expect.extend(matchers as never);

  process.env.JWT_SECRET = "test-secret-key-for-vitest";

  mock.module("next/navigation", () => ({
    useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }),
    usePathname: () => "/",
  }));
  ```

  Replace with:

  ```ts
  import { mock } from "bun:test";

  process.env.JWT_SECRET = "test-secret-key-for-vitest";

  mock.module("next/navigation", () => ({
    useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }),
    usePathname: () => "/",
  }));
  ```

  Removed: the `expect` import, the `import * as matchers` line, the happy-dom comment block, and the `expect.extend(matchers as never)` call. The `*.test.ts` suite never uses RTL matchers; jest-dom now lives only in `vitest.setup.ts`.

- [ ] Step 4: Run `bun run test:unit`. This runs `bun test --path-ignore-patterns '**/*.test.tsx'` — all `*.test.ts` files run; the login test is excluded. Expect: **120 pass, 0 fail**.

- [ ] Step 5: Run `bun run test`. This runs both suites in sequence. Expect: bun suite passes (120 tests), then Vitest suite passes (4 tests), no file executed by both runners.

- [ ] Step 6: Verify no `@happy-dom/global-registrator` import remains anywhere:

  ```bash
  grep -r "global-registrator" src/ --include="*.ts" --include="*.tsx"
  ```

  Expect: no output.

- [ ] Step 7: Run `npm run lint` — fix any issues, re-run to confirm clean.

- [ ] Step 8: Commit:

  ```
  chore(test): wire bun+vitest split — update scripts, clean preload, drop global-registrator
  ```

---

### Task 5: Fix pre-existing tsc errors in auth.test.ts and simpsons.test.ts

**Files:**

- Modify: `src/lib/__tests__/auth.test.ts`
- Modify: `src/lib/__tests__/simpsons.test.ts`

**Context for this task:** `tsc --noEmit` reports 3 pre-existing type errors that are unrelated to the Vitest migration. Two are in `auth.test.ts` where `role: "admin"` is inferred as `string` but `signToken` / `verifyToken` expect a `JwtPayload` whose `role` is `"admin" | "viewer"`. Three are in `simpsons.test.ts` where `global.fetch = async ...` assignments don't satisfy `typeof fetch` because the mock is missing the `preconnect` property. Run `bun run typecheck` first to confirm you see these errors, then apply the fixes.

`JwtPayload` is defined in `src/lib/types.ts`:

```ts
export interface JwtPayload {
  userId: number;
  email: string;
  name: string;
  role: Role;
}
export type Role = "admin" | "viewer";
```

- [ ] Step 1: Run `bun run typecheck` (`tsc --noEmit`). Confirm you see errors in `auth.test.ts` and `simpsons.test.ts`. (There may also be residual errors from the login test if the Vitest type augmentation is not yet picked up globally — fix auth and simpsons first, then re-run to check the final count.)

- [ ] Step 2: In `src/lib/__tests__/auth.test.ts`, add a type import at the top of the file (after the existing imports):

  ```ts
  import type { JwtPayload, Role } from "@/lib/types";
  ```

  Then annotate the two payload literals in `describe("signToken")` and `describe("verifyToken")` as `JwtPayload`:

  In `describe("signToken")`, change:

  ```ts
  const payload = {
    userId: 1,
    email: "test@example.com",
    name: "Test User",
    role: "admin",
  };
  ```

  To:

  ```ts
  const payload: JwtPayload = {
    userId: 1,
    email: "test@example.com",
    name: "Test User",
    role: "admin",
  };
  ```

  In `describe("verifyToken")`, the first `it` block has the same pattern — annotate it the same way:

  ```ts
  const payload: JwtPayload = {
    userId: 1,
    email: "test@example.com",
    name: "Test User",
    role: "admin",
  };
  ```

  The expired-token test also has a payload with `role: "admin"` plus an `exp` field. Annotate `role` inline with `as Role` (since `JwtPayload` doesn't include `exp`):

  ```ts
  const payload = {
    userId: 1,
    email: "test@example.com",
    name: "Test User",
    role: "admin" as Role,
    exp: Math.floor(Date.now() / 1000) - 1,
  };
  ```

- [ ] Step 3: In `src/lib/__tests__/simpsons.test.ts`, cast each `global.fetch = async ...` assignment as `typeof fetch`. There are three such assignments (one in each `it` block). For each one, wrap the async function in parentheses and append `as typeof fetch`:

  In "returns imageUrl..." test, change:

  ```ts
  global.fetch = async (_url: string | URL | Request, _init?: RequestInit) => {
    callCount++;
    if (callCount === 1) {
      return new Response(JSON.stringify({ pages: 3, results: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({
        results: [{ portrait_path: "/homer.png", name: "Homer Simpson" }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };
  ```

  To:

  ```ts
  global.fetch = (async (_url: string | URL | Request, _init?: RequestInit) => {
    callCount++;
    if (callCount === 1) {
      return new Response(JSON.stringify({ pages: 3, results: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({
        results: [{ portrait_path: "/homer.png", name: "Homer Simpson" }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }) as typeof fetch;
  ```

  In "throws when non-OK" test, change:

  ```ts
  global.fetch = async () => new Response(null, { status: 500 });
  ```

  To:

  ```ts
  global.fetch = (async () => new Response(null, { status: 500 })) as typeof fetch;
  ```

  In "throws when results array is empty" test, change:

  ```ts
  global.fetch = async () => {
    callCount++;
    if (callCount === 1) {
      return new Response(JSON.stringify({ pages: 1, results: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  ```

  To:

  ```ts
  global.fetch = (async () => {
    callCount++;
    if (callCount === 1) {
      return new Response(JSON.stringify({ pages: 1, results: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  ```

- [ ] Step 4: Run `bun run typecheck`. Expect: **0 errors**.

  If there are remaining errors in the login test (e.g., matchers not typed), check that `vitest.setup.ts` imports `@testing-library/jest-dom/vitest` — this augments the Vitest matcher types and is picked up by the TypeScript compiler when it processes the project. If tsc still doesn't see the augmentation, add `"@testing-library/jest-dom"` to `compilerOptions.types` in `tsconfig.json`.

- [ ] Step 5: Run `bun run test:unit` — expect 120 pass (the test logic is unchanged; only type annotations were added).

- [ ] Step 6: Run `npm run lint` — fix any issues, re-run to confirm clean.

- [ ] Step 7: Commit:

  ```
  fix(types): annotate JwtPayload in auth.test.ts, cast fetch mock in simpsons.test.ts
  ```

---

### Task 6: Add runner-selection rule and update CLAUDE.md

**Files:**

- Create: `.claude/rules/tests.md`
- Modify: `CLAUDE.md`

**Context for this task:** Claude Code auto-discovers rule files from `.claude/rules/` and loads them when a file matching the rule's `paths:` frontmatter is opened. A path-scoped rule here teaches future sessions which runner to use for new test files, preventing a future session from silently adding bun hacks to a `.test.tsx` file.

`CLAUDE.md` already has a **Work verification** section listing `npm run test` and `npm run lint`. Adding `npm run typecheck` ensures type correctness is verified after every feature implementation.

- [ ] Step 1: Create the directory `.claude/rules/` if it doesn't exist, then create `.claude/rules/tests.md` with this content:

  ```md
  ---
  paths:
    - "**/*.test.ts"
    - "**/*.test.tsx"
  ---

  # Test runner selection

  This repo uses two non-overlapping test runners:

  | File extension | Runner             | Command                   |
  | -------------- | ------------------ | ------------------------- |
  | `*.test.tsx`   | Vitest (happy-dom) | `bun run test:components` |
  | `*.test.ts`    | bun test           | `bun run test:unit`       |

  **Rule of thumb:** rendering a React component → `.tsx` → Vitest. No rendering (API routes, lib, middleware) → `.ts` → bun test.

  **Boundary mechanism:** `bun test` uses `--path-ignore-patterns '**/*.test.tsx'` to skip component tests; Vitest uses `include: ["**/*.test.tsx"]` to claim them. No file is run by both runners.

  **Available scripts:**

  - `bun run test` — run both suites in sequence
  - `bun run test:unit` — bun suite only (`*.test.ts`)
  - `bun run test:components` — Vitest suite only (`*.test.tsx`)
  - `bun run test:watch` — bun suite in watch mode
  - `bun run test:coverage` — bun suite with coverage
  - `bun run typecheck` — `tsc --noEmit`

  **Do not** add `GlobalRegistrator.register()`, `await import(...)` workarounds, or `afterEach(cleanup)` to component tests — Vitest + happy-dom handles all of this automatically via `vitest.config.ts` and `vitest.setup.ts`.
  ```

- [ ] Step 2: Open `CLAUDE.md`. The **Work verification** section currently ends with:

  ```
  - `npm run test` to run unittests
  - `npm run lint` to lint the code
  - If installed and applicable use `playwright-cli` to test the
  ```

  Add `npm run typecheck` as a third bullet after `npm run lint`:

  ```
  - `npm run test` to run unittests
  - `npm run lint` to lint the code
  - `npm run typecheck` to check types
  - If installed and applicable use `playwright-cli` to test the
  ```

- [ ] Step 3: Run `bun run test` — expect both suites pass (120 bun tests + 4 Vitest tests).

- [ ] Step 4: Run `bun run typecheck` — expect 0 errors.

- [ ] Step 5: Run `npm run lint` — fix any issues, re-run to confirm clean.

- [ ] Step 6: Commit:

  ```
  docs: add test runner rule, add typecheck to CLAUDE.md verification
  ```
