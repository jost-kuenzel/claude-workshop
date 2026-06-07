---
name: strip-trailing-hyphen-from-slugs
description: Add a pure truncateSlug helper that slices a slug to a max length and strips any trailing hyphen, and use it at the one truncation call site so branch names and plan filenames never end with a stray hyphen.
status: draft
issue: 30
---

# Strip trailing hyphen from truncated slugs

## Purpose

`tools/factory/workflow-go.ts` builds a branch slug as
`slugify(title …).slice(0, 40)`. Slicing **after** slugify can cut mid-word and
leave a stray trailing hyphen (e.g. `factory/issue-31--fix-the-thing-`), which
then shows up in both the branch name and the derived plan filename. This change
makes truncation hyphen-safe via a small reusable helper.

It is a deliberately small, self-contained change whose secondary purpose is to
exercise the new CI sandbox end-to-end on a low-risk task.

## Approach

Add a pure `truncateSlug` helper next to `slugify` in `spec-author.ts` and call
it at the single programmatic truncation site. `slugify` already strips
leading/trailing hyphens from the _full_ slug, so after truncation only a
**trailing** hyphen can appear — the helper only needs to slice then strip that.

No word-boundary logic (a mid-word cut like `fix-the-thi` is acceptable); that
was considered and rejected as beyond the issue's scope (YAGNI).

## Components

### `truncateSlug(slug, max = 40)` — `tools/factory/spec-author.ts`

```ts
export function truncateSlug(slug: string, max = 40): string {
  return slug.slice(0, max).replace(/-+$/, "");
}
```

Pure and total: no throwing, no I/O. Placed beside `slugify` because they form a
"build a filesystem/ref-safe slug" pair. `slugify` stays unchanged.

### Call site — `tools/factory/workflow-go.ts`

- Import: `import { slugify, truncateSlug } from "./spec-author";`
- Line 96: `const slug = truncateSlug(slugify(title || \`issue-${args.issue}\`));`

This is the only `.slice(0, 40)` truncation in the factory scripts. The resulting
`slug` feeds **both** the branch name and `planFilename(...)`, so this one swap
fixes both. The spec filename is composed during brainstorm (no code-level
truncation exists for it today), so it is out of scope; the exported helper is
available should spec authoring adopt it later.

## Data flow

`issue title → slugify (lowercase, non-alnum→'-', strip outer '-') →
truncateSlug (slice to 40, strip trailing '-') → branch name + plan filename`.
Unchanged otherwise.

## Error handling

None required — `truncateSlug` is a pure total function over any string. A `max`
of 0 yields `""`, which is consistent with the existing fallback behavior and not
a reachable case (titles default to `issue-<N>`).

## Testing

Extend the existing `tools/factory/__tests__/spec-author.test.ts` (bun test) with
`truncateSlug` cases:

- slug shorter than `max` → returned unchanged
- slug with no trailing hyphen after slice → unchanged (just sliced)
- slice lands immediately after a hyphen → trailing hyphen stripped
  (`truncateSlug("ab-cd", 3)` → `"ab"`)
- multiple trailing hyphens stripped (`replace(/-+$/, "")`)
- default `max = 40` boundary: a >40-char slug is cut to ≤40 with no trailing `-`
- a slug whose 40th char is a hyphen → no trailing hyphen in the result

## Out of scope / non-goals

- No change to `slugify`.
- No word-boundary-aware truncation.
- No new truncation code for the spec filename (none exists).
- No unrelated refactoring of `workflow-go.ts`.
