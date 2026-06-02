---
name: factory-brainstorm
description: Use to turn an idea into a factory-ready spec committed to main. Guided one-question-at-a-time dialogue → 2-3 approaches → section-by-section design → spec → independent review loop → human gate → commit+push → factory-go hint. Fork-and-distilled from superpowers brainstorming; no runtime dependency.
---

# Factory Brainstorm

Turn an idea into a factory-ready spec committed to `main`. Local, interactive.
Do NOT write code or scaffold anything — this skill ends at a committed spec.

## Process

1. **Explore project context** (files, docs, recent commits).
2. **Resolve the issue number** (required before writing the spec):
   - Given: `bun scripts/factory/spec-author.ts --issue <N>` to read the issue body
     as the starting idea.
   - Not given: invoke the `factory-issue` skill. If enough context is already
     gathered, hand it over so it creates the issue without re-asking. Get `N` back.
3. **Clarifying dialogue** — ONE question at a time (purpose, constraints, success
   criteria). Multiple-choice when possible.
4. **Propose 2-3 approaches** with trade-offs and a recommendation.
5. **Present the design section-by-section**, approval after each section.
6. **Write the spec** to the path produced by `specFilename(<stamp>, N, <slug>)`,
   with frontmatter from `buildFrontmatter` (`issue: N`). The
   `factory-spec-frontmatter` hook validates `issue:` on write.
7. **Review loop**: dispatch the `factory-brainstorm-reviewer` agent. If
   `changes-requested`, edit the spec per findings and re-dispatch until `approved`.
8. **Human gate**: ask the user to review the spec; loop back on requested changes.
9. **Commit + push**: `bun scripts/factory/spec-author.ts --commit-spec <spec path>`
   (honors `FACTORY_DRY_RUN=1`; push is required so factory-go can find the spec).
10. **Print the hint**:
    `Spec on main. To start implementation: gh issue edit N --add-label factory-go`

## Keep / drop (vs superpowers brainstorming)

Keep: context exploration, one-question-at-a-time dialogue, 2-3 approaches,
section-by-section approval. Drop: the visual/browser companion.

## Terminal state

This skill ends at the committed+pushed spec and the factory-go hint. Do NOT invoke
writing-plans — the factory pipeline owns planning.
