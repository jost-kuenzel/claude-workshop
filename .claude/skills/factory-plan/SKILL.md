---
name: factory-plan
description: Use to turn a committed factory spec into a checkbox task plan. Produces a plan with a Task Checklist section as the single source of truth for task completion.
---

# Factory Plan

Turn a spec into a bite-sized, checkbox-driven implementation plan for an engineer with zero context for this codebase. DRY. YAGNI. TDD. Frequent commits.

Assume a skilled developer who knows almost nothing about this toolset or problem domain and isn't strong at test design — spell out _good_ tests (what behavior, what assertions), not just "write a test". Every task is implemented by a **fresh subagent with no memory of the other tasks**, so each task must stand entirely on its own.

## Before writing tasks (scope + file map)

1. **Scope check** — if the spec spans multiple independent subsystems that should have been split during brainstorming, say so and recommend one plan per subsystem (each producing working, testable software). Don't silently cram them into one plan.
2. **Map the files first** — before defining tasks, list every file you'll create or modify and the single responsibility of each. This is where decomposition gets locked in: one clear responsibility per file, files that change together live together, split by responsibility not by technical layer. In this codebase, follow existing patterns; only restructure a file you're already touching, not the whole tree. The file map drives the task breakdown — each task produces self-contained, independently sensible changes.

## Verification gate (read the spec's `## Verification` section)

Every spec ends with a `## Verification` section. Read it and act:

- **`UI surface: no`** → do nothing extra (factory/infra and backend-only work).
- **`UI surface: yes`** (the section also carries an abstract `Outcome:`):
  1. **Annotate** the frontend implementation tasks (the ones that change what a user
     sees) with an explicit expectation: "self-verify in browser via the
     `frontend-verify` skill — drive Chromium to where the Outcome is observable and
     confirm it renders with no same-origin console errors." You derive the concrete
     route and steps; the spec stays abstract.
  2. **Emit one evidence task as the final checklist line.** It runs on the integrated
     final state and captures a single curated screenshot:
     - server up, navigate to where the `Outcome` is observable (as in `frontend-verify`),
     - `playwright-cli screenshot --filename=docs/factory/evidence/issue-<N>/<slug>.png`
       (writes straight to the tracked path),
     - `git add` + commit, then teardown.
     - **Frame it as non-TDD:** word it as "evidence capture, not test-first: produce
       the screenshot artifact" so neither the reviewers nor the implementer's own
       "Testing — TDD followed" self-review flags it. A screenshot commit breaks
       neither lint nor tests; "screenshot produced + committed" is the acceptance.

## Required output structure

The plan MUST contain, in this order:

1. A title `# <Feature> Implementation Plan`, immediately followed by a short
   context block (each per-task subagent starts cold and reads only this):
   `**Goal:**` one sentence, `**Architecture:**` 2-3 sentences, `**Tech Stack:**`
   the key libraries/tools.
2. **A `## Task Checklist` section** — one line per task, exactly:
   `- [ ] Task <n>: <short title>` (start every task unchecked). This section is the
   single source of truth for task completion; the factory pipeline reads and flips
   only these lines.
3. A `---` separator.
4. One `### Task <n>: <short title>` detail section per task, in order. Each detail
   section lists exact files (Create/Modify/Test with paths) and bite-sized steps.
   Step-level `- [ ]` checkboxes inside a task body are allowed and are ignored by the
   pipeline.

## Frontmatter

Carry the spec's `issue:` number forward into the plan frontmatter:

---

issue: <N>
spec: <relative spec path>

---

## Task granularity

Each step is one 2–5 minute action: write the failing test, run it (expect fail),
write minimal code, run it (expect pass), commit. Show real code in every code step —
never "TODO", "implement later", or "add error handling".

**No cross-task references.** Because each task runs in a fresh subagent that may
read tasks out of order, never write "same as Task N", "see Task 3", or "similar to
above" — repeat the actual code instead. Never reference a type, function, or method
that no task defines. Each task must be fully implementable reading that task alone
plus the context block.

## Bite-sized step example

```

### Task 1: Parse the CSV header

**Files:**

- Create: `src/csv.ts`
- Test: `src/csv.test.ts`

- [ ] Step 1: write failing test for header parsing
- [ ] Step 2: run `bun test src/csv.test.ts` — expect FAIL
- [ ] Step 3: implement minimal parseHeader
- [ ] Step 4: run `bun test src/csv.test.ts` — expect PASS
- [ ] Step 5: commit

```

## Self-review before finishing

- Every spec requirement maps to a task.
- No placeholders.
- Types/method names used in later tasks match earlier tasks.
- No cross-task references ("see Task N", "same as above"); each task stands alone.
- Every file in the file map is created/modified by some task, and every task's
  files trace back to the map.

## Review loop (before committing)

After self-review, but **before committing the plan**, dispatch the
`factory-plan-reviewer` agent to review the written plan against its spec. The
pipeline runs headless with no human gate between plan and implementation, so this
is the plan's only independent scrutiny — do not skip it.

- If the verdict is `changes-requested`, edit the plan to resolve every **Issue**
  (Recommendations are advisory), then re-dispatch. Repeat until `approved`.
- Only after `approved` do you commit the plan.
