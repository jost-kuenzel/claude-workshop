---
name: factory-issue
description: Use to turn a rough idea or bug report into a lean, skimmable GitHub issue for the AI factory. A mini-brainstorm — asks feature-or-bug, then a few one-at-a-time questions to nail the core, then files the issue via scripts/factory/issue-create.ts.
---

# Factory Issue

Produce ONE lean, skimmable GitHub issue. This is a mini-brainstorm, not a full design.

## Process

1. Ask **feature or bug?** first.
2. Ask a _few_ clarifying questions, ONE at a time — just enough to nail the core.
   - Feature: What / Why / (optional) Constraints.
   - Bug: What's broken / Expected / Where (repro or pointer).
3. Keep the body short and skimmable. No essays.
4. Create the issue via the helper (honors FACTORY_DRY_RUN=1):
   - Feature: `bun scripts/factory/issue-create.ts --type feature --title "<title>" --what "<what>" --why "<why>" [--constraints "<constraints>"]`
   - Bug: `bun scripts/factory/issue-create.ts --type bug --title "<title>" --broken "<broken>" --expected "<expected>" --where "<where>"`
5. Print the returned issue number/URL.

## When delegated from factory-brainstorm

If invoked with context already gathered, do NOT re-ask — compose the issue from the
provided context and create it directly. Return the issue number to the caller.
