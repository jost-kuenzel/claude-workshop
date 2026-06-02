# CLAUDE.md

## Filing GitHub issues

When the user asks to create, write, file, open, draft, or log a GitHub issue —
including terse one-liners like "write a gh issue" — you MUST invoke the
`factory-issue` skill first, before doing anything else. Never run
`gh issue create` (or otherwise file an issue) directly. Every issue in this
repo feeds the AI factory pipeline and must use its format and labels, which the
skill applies; a hand-rolled issue silently breaks that contract.

This rule exists because Claude Code, by default, skips consulting a skill for
tasks it judges trivial enough to do directly — and filing an issue looks
trivial. This instruction overrides that default.

## Work verification

After having finished implementing a feature ALWAYS verify your work. Leave only
steps to verify for the user that you cannot accomplish yourself. Use provided
tools as these:

- `npm run test` to run unittests
- `npm run lint` to lint the code
- If installed and applicable use `playwright-cli` to test the
