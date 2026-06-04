---
name: factory-brainstorm
description: Use to turn an idea into a factory-ready spec committed to main. Guided one-question-at-a-time dialogue → 2-3 approaches → section-by-section design → spec → independent review loop → human gate → commit+push → factory-go hint. Fork-and-distilled from superpowers brainstorming; no runtime dependency.
---

# Factory Brainstorm

Turn an idea into a factory-ready spec committed to `main`. Local, interactive.
Do NOT write code or scaffold anything — this skill ends at a committed spec.

Every idea goes through this process regardless of perceived simplicity — "too
simple to need a design" is where unexamined assumptions waste the most factory
cycles. The design can be short for simple work, but you MUST present it and get
approval before committing the spec.

## Process

1. **Explore project context** (files, docs, recent commits).
2. **Resolve the issue number** (required before writing the spec):
   - Given: run `bun scripts/factory/spec-author.ts --issue <N>` — it reads the
     issue and prints it as JSON (`{title, body}`). Use the `body` as the starting
     idea for the dialogue — you STILL run the clarifying dialogue in steps 3-5
     (the issue body is a seed, not the spec).
   - Not given: invoke the `factory-issue` skill. If enough context is already
     gathered, hand it over so it creates the issue without re-asking. Get `N` back.
3. **Scope triage, then clarifying dialogue** — first assess scope: if the idea
   spans multiple independent subsystems, flag it and decompose into sub-projects
   (the independent pieces, how they relate, the build order) before brainstorming
   the first one — don't spend questions refining a project that needs splitting.
   Then ask ONE question at a time (purpose, constraints, success criteria),
   multiple-choice when possible.
4. **Propose 2-3 approaches** with trade-offs and a recommendation. Apply YAGNI —
   cut unrequested features; the factory builds whatever the spec says.
5. **Present the design section-by-section**, approval after each section. Scale
   each section to its complexity (a sentence when straightforward, up to ~200-300
   words when nuanced). Cover architecture, components, data flow, error handling,
   and testing. Follow existing patterns in the repo and fold in targeted
   improvements to code you're touching — but no unrelated refactoring.
6. **Write the spec** to
   `docs/factory/specs/<stamp>--issue-<N>--<slug>--design.md`, where `<stamp>`
   is the current `YYYY-MM-DD-HHMM` and `<slug>` is a short kebab-case slug of the
   title. Frontmatter must include `name`, `description`, `status: draft`, and
   `issue: N`. The `factory-spec-frontmatter` hook validates `issue:` on write.
   (`scripts/factory/spec-author.ts`'s `buildFrontmatter` produces this shape, but
   you must supply all four fields explicitly.)
7. **Review loop**: dispatch the `factory-brainstorm-reviewer` agent. If
   `changes-requested`, edit the spec per findings and re-dispatch until `approved`.
8. **Human gate**: ask the user to review the spec; loop back on requested changes.
9. **Commit + push**: `bun scripts/factory/spec-author.ts --commit-spec <spec path>`
   (honors `FACTORY_DRY_RUN=1`; push is required so factory-go can find the spec).
10. **Print the hint**:
    `Spec on main. To start implementation: gh issue edit N --add-label factory-go`

## Design principles

Design for isolation and clarity. Break the system into small units that each have
one clear purpose, communicate through well-defined interfaces, and can be tested
independently. For each unit you should be able to answer: what does it do, how do
you use it, what does it depend on? If someone can't understand a unit without
reading its internals, or you can't change the internals without breaking
consumers, the boundaries need work. A file growing large is a signal it's doing
too much. Well-bounded units also make the factory's downstream plan and
implementation steps more reliable.

## Keep / drop (vs superpowers brainstorming)

Keep: context exploration, scope triage/decomposition, one-question-at-a-time
dialogue, 2-3 approaches, section-by-section approval, design-for-isolation
principles, YAGNI. Drop: the visual/browser companion; the author self-review
(replaced by the independent `factory-brainstorm-reviewer`); the writing-plans
transition (the factory owns planning).

## Terminal state

This skill ends at the committed+pushed spec and the factory-go hint. Do NOT invoke
writing-plans — the factory pipeline owns planning.
