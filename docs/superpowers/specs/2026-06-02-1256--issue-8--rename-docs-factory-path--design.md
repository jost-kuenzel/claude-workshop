---
name: rename-docs-factory-path
description: Rename the factory spec/plan artifact root from docs/superpowers to docs/factory, migrate existing artifacts, and repoint all references.
status: draft
issue: 8
---

# Rename `docs/superpowers` → `docs/factory`

## Goal

Rename the spec/plan artifact root from `docs/superpowers/{specs,plans}` to
`docs/factory/{specs,plans}`, migrate the existing artifacts, and repoint every
reference that hard-codes the path. Clean cut — no dual-path/back-compat support;
`docs/superpowers/` is removed entirely.

## Why

The `superpowers` segment is a historical leftover from when the factory pipeline
was forked from the superpowers skills. It is now misleading: the pipeline is the
"factory", matching the naming used everywhere else in the repo (skills, agents,
scripts). Aligning the path removes confusion for contributors.

## Scope

### 1. Migrate artifacts (`git mv`, content untouched)

Move the 4 existing files, preserving filenames:

- `docs/superpowers/specs/2026-05-27-1730--ai-factory--design.md` → `docs/factory/specs/…`
- `docs/superpowers/specs/2026-06-02-1020--issue-6--factory-brainstorm--design.md` → `docs/factory/specs/…`
- `docs/superpowers/plans/2026-06-01-1730-ai-factory.md` → `docs/factory/plans/…`
- `docs/superpowers/plans/2026-06-02-1036--issue-6--factory-brainstorm--plan.md` → `docs/factory/plans/…`

(The spec for _this_ issue will also live under the old path at authoring time and
must be migrated along with the rest.)

### 2. Repoint references (`docs/superpowers` → `docs/factory`)

Most occurrences are plain strings (replace `docs/superpowers` → `docs/factory`),
but one is a **regex literal with escaped slashes** and must be edited in that form:

- `scripts/factory/spec-author.ts` — `specPath` builder (plain string)
- `scripts/factory/spec-author.test.ts` — test fixtures (plain string)
- `scripts/factory/workflow-go.ts` — specs glob + plan-path builder (plain strings, lines 58 & 83)
- `.claude/hooks/factory-spec-frontmatter.ts` — **escaped regex** on line 8:
  `const SPEC_GLOB = /docs\/superpowers\/specs\/.*\.md$/;` → must become
  `/docs\/factory\/specs\/.*\.md$/`. A plain `docs/superpowers` find/replace will
  NOT match this; miss it and the runtime path guard silently stops validating any
  spec. Highest-risk edit in the change.
- `.claude/hooks/factory-spec-frontmatter.test.ts` — test fixtures (plain strings)
- `.claude/skills/factory-brainstorm/SKILL.md` — step 6 spec-path instruction (plain string)

This is the complete surface area. The `factory-plan` and `factory-implement-task`
skills/agents do **not** hard-code the path — they obtain it via `workflow-go.ts`,
so updating `workflow-go.ts` covers them.

## Non-goals

- `~/.claude/CLAUDE.md` "Superpowers Artifacts" section points at the old path but is
  a user-global file outside this repo; the factory does not touch it. Flagged here
  as a manual follow-up for the maintainer to update separately.
- No dual-path / transitional glob — clean cut only.
- No renaming of the `factory-*` skills, and no rewriting of the word "superpowers"
  inside the prose/content of the migrated artifacts. Only the directory path changes.

## Success criteria / verification

- `grep -rn "docs/superpowers" .claude scripts` returns nothing. **Scope is `.claude`
  and `scripts` only — deliberately NOT `docs/`.** The migrated artifacts contain the
  literal `docs/superpowers` inside their own prose, and per the non-goals that prose
  is intentionally left untouched; a repo-wide grep would therefore never pass and must
  not be substituted here.
- `docs/superpowers/` no longer exists; `docs/factory/specs` and `docs/factory/plans`
  contain all migrated files — the 4 listed in section 1 **plus this issue's own design
  spec** (5 in total once this spec is moved along with the rest).
- `npm run test` (or `bun test`) passes — the frontmatter hook and spec-author tests
  are green against the new paths.
- A spec authored via `scripts/factory/spec-author.ts` lands under `docs/factory/specs/`.
