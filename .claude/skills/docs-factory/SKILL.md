---
name: docs-factory
description: Regenerate the AI factory process guide at docs/factory/factory-process-guide.md so the documentation stays in sync as the factory evolves. Use this skill WHENEVER the user wants to write, refresh, update, regenerate, or fix the factory docs / factory process guide / "how the factory works" documentation — including terse asks like "update the factory docs", "the factory changed, refresh the guide", or "document the pipeline". The skill re-explores the live factory (skills, subagents, GitHub Actions workflows, scripts, labels) from scratch and upserts a single canonical guide with mermaid diagrams, so the docs reflect reality rather than a stale snapshot. Prefer this over hand-editing the guide, because partial edits drift from the actual pipeline.
---

# Docs Factory

Keep one canonical, accurate guide to the AI factory pipeline alive as the
factory evolves. The factory (skills, subagents, GitHub Actions, scripts) changes
over time; this skill **re-derives the guide from the source of truth every run**
rather than patching prose, so the docs never drift from the implementation.

**Output (single file, upserted):**
`docs/factory/factory-process-guide.md`

Overwrite it wholesale each run. Do not try to diff or surgically patch the
existing guide — re-explore the live pipeline and regenerate. A full rewrite from
freshly-read sources is what guarantees accuracy; incremental edits silently
preserve stale claims.

## Process

### 1. Re-explore the live factory (always from scratch)

Never trust the existing guide or your memory of the pipeline — read the actual
files. The whole point of this skill is that the factory has likely changed.
Gather, by reading the real sources:

- **Skills** — every `.claude/skills/factory-*/SKILL.md`. For each: what it does,
  what it consumes/produces, and how it hands off to the next stage.
- **Subagents** — every `.claude/agents/factory-*.md`. For each: role
  (implementer vs reviewer), what it reviews, its return values
  (e.g. `approved` / `changes-requested`), tools, and model.
- **GitHub Actions** — every `.github/workflows/factory-*.yml`. For each: the
  `on:` event and the `if:` gate (label name, comment substring, etc.), and which
  script it runs. Quote the trigger config exactly — these are load-bearing.
- **Scripts** — `scripts/factory/*.ts`. Identify the orchestrators
  (e.g. `workflow-go.ts`, `workflow-revise.ts`) and read them to recover the
  **actual step order** of the automated run. Note the helper scripts each step
  invokes and any tool allowlists. Don't infer the sequence — read it.
- **Labels & commands** — how issues/labels/PR comments drive the pipeline
  (e.g. which label starts the build, which comment triggers a revision). Confirm
  label names from `issue-create.ts` and the workflow `if:` conditions, not from
  the prose.

This is a broad read across many files. If a fan-out search agent is available,
dispatch one to map everything and report names + triggers + step order; then
spot-check the load-bearing facts (workflow triggers, the orchestrator's step
sequence, exact label strings) by reading those files directly before you write.
Accuracy of names, triggers, and ordering is the one thing this guide must get
right.

### 2. Reconstruct the end-to-end flow

Trace one idea from inception to merge and note where each stage is **human-driven
and local** (run in a Claude Code session) versus **automated in CI** (run by a
GitHub Action). The handoff points — a committed artifact, a label, a comment —
are the spine of the guide. Get them right:

idea → issue → spec → (label) → plan → task loop (implement → review) →
PR → (revise) → merge.

### 3. Upsert the guide

Write `docs/factory/factory-process-guide.md`, overwriting any existing file.
Keep it skimmable and diagram-led. Use the structure below.

## Guide structure

Produce these sections, in order:

1. **Title + intro** — one paragraph framing the factory, then a short bulleted
   tour of the four kinds of part: GitHub (control plane), GitHub Actions
   workflows, skills, subagents — plus a note that Bun/TypeScript scripts glue it
   together.
2. **The big picture** — a `mermaid` `flowchart` of the whole pipeline, grouped
   into subgraphs by stage, with a `classDef`-based color legend distinguishing
   human actions, GitHub objects, skills, subagents, scripts, and artifacts.
   Follow the legend with a one-line key.
3. **Stage-by-stage walkthrough** — one subsection per stage. Name every skill,
   agent, script, workflow, label, and artifact path involved. Call out the
   invariants that matter (e.g. the plan's task checklist as the single source of
   truth, spec-review-before-quality-review ordering, test-first). Mark each stage
   as local/human-driven or automated/CI.
4. **The automated build, in detail** — a `mermaid` `sequenceDiagram` of the
   CI orchestration (the `factory-go` path): branch/PR creation, plan generation
   - review loop, the per-task implement→spec-review→quality-review loop, and PR
     finalize. Mirror the **actual step order** you read from the orchestrator
     script.
5. **Reference tables** — compact tables for: Skills, Subagents, GitHub Actions
   (workflow → trigger → script), Scripts (script → role), and Labels & commands
   (trigger → effect).
6. **Quick start** — a short copy-pasteable sequence showing the human touch
   points (invoke the issue skill, invoke the brainstorm skill, add the start
   label, comment to revise, approve & merge).

## Mermaid guidance

The diagrams are the heart of the guide — invest in them.

- Use `flowchart TD` for the overview and `sequenceDiagram` for the CI detail.
- Group the flowchart into `subgraph` blocks per stage so the lifecycle reads
  top-to-bottom.
- Color-code node classes with `classDef` and a final legend line so a reader can
  tell a human action from a skill from a script at a glance. Suggested classes:
  `human`, `gh`, `skill`, `agent`, `script`, `artifact`.
- Keep node labels short; avoid characters that trip the parser (prefer plain
  text, use `<br/>` for line breaks, avoid stray parentheses/quotes inside
  labels). You cannot render mermaid here — keep labels simple to reduce the
  chance of a syntax error, and tell the user to preview the rendered diagram.

## Finishing

- Write the file, then tell the user the path and give a 2–3 line summary of what
  changed versus the previous guide (new/removed skills, agents, workflows, or
  reordered steps) if you can tell — this is the signal that the docs actually
  tracked an evolution.
- Note that you could not render the mermaid; ask them to preview it and report
  any diagram that fails to parse so you can fix it.
- Do not commit unless the user asks. If they do, follow the repo's commit
  conventions.
