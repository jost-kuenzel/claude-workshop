---
name: factory-plan
description: Use to turn a committed factory spec into a checkbox task plan. Produces a plan with a Task Checklist section as the single source of truth for task completion.
---

# Factory Plan

Turn a spec into a bite-sized, checkbox-driven implementation plan for an engineer with zero context for this codebase. DRY. YAGNI. TDD. Frequent commits.

## Required output structure

The plan MUST contain, in this order:

1. A title `# <Feature> Implementation Plan`.
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
