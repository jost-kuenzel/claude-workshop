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

**Boundary mechanism:** `bun test` is scoped to the directories that hold the `*.test.ts` suites (`src/__tests__ src/lib src/app/api tools`), so it never picks up component tests; Vitest uses `include: ["**/*.test.tsx"]` to claim them. No file is run by both runners.

**Available scripts:**

- `bun run test` — run both suites in sequence (`bun test …` then `vitest run`)
- `bun run test:unit` — bun suite only (`*.test.ts`)
- `bun run test:components` — Vitest suite only (`*.test.tsx`)
- `bun run test:watch` — bun suite in watch mode
- `bun run test:coverage` — both suites with coverage
- `bun run typecheck` — `tsc --noEmit`

**Do not** add `GlobalRegistrator.register()`, `await import(...)` workarounds, or `afterEach(cleanup)` to component tests — Vitest + happy-dom handles all of this automatically via `vitest.config.ts` and `vitest.setup.ts`.
