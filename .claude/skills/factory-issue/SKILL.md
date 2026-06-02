---
name: factory-issue
description: Turn a rough idea or bug report into a lean, skimmable GitHub issue for the AI factory. A mini-brainstorm — asks feature-or-bug, then a few one-at-a-time questions to nail the core, then files the issue via scripts/factory/issue-create.ts. Use this skill WHENEVER the user wants to write, create, file, open, draft, or log a GitHub issue in this repo — including terse one-liners like "write a gh issue", "open an issue for this", or "file a bug" — because every issue here feeds the AI factory pipeline and must use its format and labels. Do NOT create issues directly with `gh issue create`; always route through this skill, even when the request looks trivial or you already have all the context.
---

# Factory Issue

Produce ONE lean, skimmable GitHub issue. This is a mini-brainstorm, not a full design.

This skill owns **all** issue creation in this repo. Even if the request is a one-liner
and you already have the full context, file through the helper below — never shortcut to
`gh issue create`. The helper applies the factory's format and labels that the downstream
pipeline depends on; a hand-rolled `gh` issue silently breaks that contract.

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
