---
issue: 30
spec: docs/factory/specs/2026-06-07-1808--issue-30--strip-trailing-hyphen-from-slugs--design.md
---

# Strip Trailing Hyphen from Truncated Slugs Implementation Plan

**Goal:** Add a pure `truncateSlug` helper to `spec-author.ts` that slices a slug to a max length and strips any trailing hyphen, then use it at the single `.slice(0, 40)` call site in `workflow-go.ts` so branch names and plan filenames never end with a stray hyphen.

**Architecture:** `slugify` (in `spec-author.ts`) already produces a clean slug with no leading/trailing hyphens; after `.slice(0, 40)` the cut can land on a hyphen, so `truncateSlug` wraps slice + `replace(/-+$/, "")` and is placed next to `slugify`. `workflow-go.ts` imports `truncateSlug` from `spec-author` and replaces the inline `.slice(0, 40)` on line 96 with a single `truncateSlug(...)` call.

**Tech Stack:** TypeScript, Bun runtime, `bun test` for unit tests (`*.test.ts` files in `tools/factory/__tests__/`).

## Task Checklist

- [ ] Task 1: Add `truncateSlug` to `spec-author.ts` with tests
- [ ] Task 2: Wire `truncateSlug` into `workflow-go.ts`

---

### Task 1: Add `truncateSlug` to `spec-author.ts` with tests

**Files:**

- Modify: `tools/factory/spec-author.ts`
- Modify: `tools/factory/__tests__/spec-author.test.ts`

- [ ] Step 1: Open `tools/factory/__tests__/spec-author.test.ts` and append the following failing tests at the end of the file (after line 73):

```ts
test("truncateSlug returns slug unchanged when shorter than max", () => {
  expect(truncateSlug("short", 40)).toBe("short");
});

test("truncateSlug slices to max when no trailing hyphen", () => {
  expect(truncateSlug("abcde", 3)).toBe("abc");
});

test("truncateSlug strips trailing hyphen after slice", () => {
  // "ab-cd".slice(0, 3) = "ab-" → strip → "ab"
  expect(truncateSlug("ab-cd", 3)).toBe("ab");
});

test("truncateSlug strips multiple trailing hyphens", () => {
  // "a---b".slice(0, 3) = "a--" → strip → "a"
  expect(truncateSlug("a---b", 3)).toBe("a");
});

test("truncateSlug default max=40 cuts >40-char slug to ≤40 chars with no trailing hyphen", () => {
  const long = "a".repeat(39) + "-" + "b".repeat(10); // 50 chars; char 40 is '-'
  const result = truncateSlug(long);
  expect(result.length).toBeLessThanOrEqual(40);
  expect(result.endsWith("-")).toBe(false);
});

test("truncateSlug with exactly max chars and 40th char a hyphen strips it", () => {
  // build a 41-char string where index 39 (0-based) is '-'
  const s = "a".repeat(39) + "-x";
  const result = truncateSlug(s, 40);
  expect(result).toBe("a".repeat(39));
});
```

The `import { truncateSlug }` line should be added alongside the existing import from `"../spec-author"` — merge it into the destructured list at the top of the file so the import becomes:

```ts
import {
  slugify,
  specFilename,
  buildFrontmatter,
  viewIssueArgs,
  commitSpecArgs,
  issueFromSpecPath,
  truncateSlug,
} from "../spec-author";
```

- [ ] Step 2: Run `bun test tools/factory/__tests__/spec-author.test.ts` — expect **FAIL** (cannot find export `truncateSlug`).

- [ ] Step 3: Open `tools/factory/spec-author.ts` and add the `truncateSlug` export immediately after the `slugify` function (after line 12):

```ts
export function truncateSlug(slug: string, max = 40): string {
  return slug.slice(0, max).replace(/-+$/, "");
}
```

- [ ] Step 4: Run `bun test tools/factory/__tests__/spec-author.test.ts` — expect **PASS** (all tests green, including existing slugify tests).

- [ ] Step 5: Run `bun run typecheck` — expect no errors.

- [ ] Step 6: Commit:

```
git add tools/factory/spec-author.ts tools/factory/__tests__/spec-author.test.ts
git commit -m "feat(factory): add truncateSlug helper to spec-author"
```

---

### Task 2: Wire `truncateSlug` into `workflow-go.ts`

**Files:**

- Modify: `tools/factory/workflow-go.ts`

- [ ] Step 1: Open `tools/factory/workflow-go.ts`. Find the existing import on line 12:

```ts
import { slugify } from "./spec-author";
```

Replace it with:

```ts
import { slugify, truncateSlug } from "./spec-author";
```

- [ ] Step 2: Find line 96 (inside the `workflow-go` command handler, step 3 comment block):

```ts
const slug = slugify(title || `issue-${args.issue}`).slice(0, 40);
```

Replace it with:

```ts
const slug = truncateSlug(slugify(title || `issue-${args.issue}`));
```

- [ ] Step 3: Run `bun run typecheck` — expect no errors.

- [ ] Step 4: Run `bun test tools/factory/__tests__/workflow-go.test.ts` — expect **PASS** (all existing tests still green).

- [ ] Step 5: Run `bun run test:unit` — expect **PASS** (full unit suite).

- [ ] Step 6: Commit:

```
git add tools/factory/workflow-go.ts
git commit -m "fix(factory): use truncateSlug so branch names never end with a hyphen"
```
