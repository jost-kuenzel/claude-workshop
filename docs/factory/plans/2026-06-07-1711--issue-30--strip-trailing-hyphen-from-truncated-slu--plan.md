---
issue: 30
spec: docs/factory/specs/2026-06-07-1808--issue-30--strip-trailing-hyphen-from-slugs--design.md
---

# Strip Trailing Hyphen from Truncated Slugs — Implementation Plan

**Goal:** Add a pure `truncateSlug` helper to `tools/factory/spec-author.ts` and use it at the single slug-truncation call site in `tools/factory/workflow-go.ts` so that branch names and plan filenames never end with a stray hyphen.

**Architecture:** `slugify` (in `spec-author.ts`) normalises a title into a hyphen-separated lowercase slug; `truncateSlug` (new, same file) slices that slug to a max length and strips any trailing hyphen with a single `replace(/-+$/, "")`. `workflow-go.ts` imports `truncateSlug` from `spec-author` and replaces the inline `.slice(0, 40)` call with it, fixing both the branch name and the plan filename derived from `slug`.

**Tech Stack:** TypeScript, Bun runtime, `bun run test:unit` (`*.test.ts` files under `tools/`).

## Task Checklist

- [ ] Task 1: Add `truncateSlug` to `spec-author.ts` with tests
- [ ] Task 2: Wire `truncateSlug` into `workflow-go.ts`

---

### Task 1: Add `truncateSlug` to `spec-author.ts` with tests

**Files:**

- Modify: `tools/factory/spec-author.ts`
- Test: `tools/factory/__tests__/spec-author.test.ts`

**Context:** `tools/factory/spec-author.ts` currently exports `slugify` (line 7) which strips leading/trailing hyphens from the full slug. After `slugify`, callers use `.slice(0, max)` to truncate, which can leave a trailing hyphen when the slice lands on one. The new `truncateSlug` helper lives right below `slugify` in the same file.

- [ ] Step 1: Open `tools/factory/__tests__/spec-author.test.ts`. First, update the existing import at the top of the file to include `truncateSlug`:

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

Then append the following tests at the bottom of the file (after the existing `issueFromSpecPath throws` test):

```ts
test("truncateSlug returns slug unchanged when shorter than max", () => {
  expect(truncateSlug("short", 40)).toBe("short");
});

test("truncateSlug slices to max when no trailing hyphen", () => {
  expect(truncateSlug("abcde", 3)).toBe("abc");
});

test("truncateSlug strips trailing hyphen produced by slice", () => {
  // slice("ab-cd", 0, 3) → "ab-"  →  strip → "ab"
  expect(truncateSlug("ab-cd", 3)).toBe("ab");
});

test("truncateSlug strips multiple consecutive trailing hyphens", () => {
  // e.g. slug with two hyphens right at the cut point
  expect(truncateSlug("a--bc", 2)).toBe("a");
});

test("truncateSlug default max=40 cuts a 50-char slug to ≤40 with no trailing hyphen", () => {
  const long = "a".repeat(39) + "-" + "b".repeat(10); // 50 chars; position 40 is "-"
  const result = truncateSlug(long);
  expect(result.length).toBeLessThanOrEqual(40);
  expect(result.endsWith("-")).toBe(false);
});

test("truncateSlug with max=40 on slug whose 40th char is a hyphen strips it", () => {
  // 39 'a's followed by '-' followed by more chars → slice(0,40) ends with '-'
  const slug = "a".repeat(39) + "-extra";
  const result = truncateSlug(slug, 40);
  expect(result).toBe("a".repeat(39));
});
```

- [ ] Step 2: Run `bun run test:unit` — expect **FAIL** (truncateSlug is not exported yet).

- [ ] Step 3: Open `tools/factory/spec-author.ts` and add the following function immediately after the closing brace of `slugify` (after line 12):

```ts
export function truncateSlug(slug: string, max = 40): string {
  return slug.slice(0, max).replace(/-+$/, "");
}
```

- [ ] Step 4: Run `bun run test:unit` — expect **PASS** for all `truncateSlug` tests and no regressions in existing tests.

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

**Context:** `tools/factory/workflow-go.ts` line 12 already imports `slugify` from `"./spec-author"`. Line 96 reads:

```ts
const slug = slugify(title || `issue-${args.issue}`).slice(0, 40);
```

This `.slice(0, 40)` is the only programmatic truncation in the factory scripts. The `slug` variable feeds both `branch` (line 97) and `planFilename(...)` (line 99), so replacing this one line fixes both outputs.

`truncateSlug` was added to `tools/factory/spec-author.ts` in Task 1 and has the signature `truncateSlug(slug: string, max = 40): string`.

- [ ] Step 1: Open `tools/factory/workflow-go.ts`. Change line 12 from:

```ts
import { slugify } from "./spec-author";
```

to:

```ts
import { slugify, truncateSlug } from "./spec-author";
```

- [ ] Step 2: Change line 96 from:

```ts
const slug = slugify(title || `issue-${args.issue}`).slice(0, 40);
```

to:

```ts
const slug = truncateSlug(slugify(title || `issue-${args.issue}`));
```

- [ ] Step 3: Run `bun run typecheck` — expect no errors.

- [ ] Step 4: Run `bun run test:unit` — expect all tests pass (including the `workflow-go` suite if it exercises `slug` construction).

- [ ] Step 5: Commit:

```
git add tools/factory/workflow-go.ts
git commit -m "fix(factory): use truncateSlug to strip trailing hyphen from branch/plan slug"
```
