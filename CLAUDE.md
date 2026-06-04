# CLAUDE.md

## The AI factory

How the factory pipeline works (GitHub, workflows, skills, subagents) is
documented in [docs/factory/factory-process-guide.md](./docs/factory/factory-process-guide.md).
Keep it fresh with the `docs-factory` skill whenever the pipeline changes.

## Filing GitHub issues

To create, write, file, open, draft, or log a GitHub issue — including terse
one-liners — you MUST invoke the `factory-issue` skill first. Never run
`gh issue create` directly; it bypasses the format and labels the factory
pipeline depends on.

## Work verification

After having finished implementing a feature ALWAYS verify your work. Leave only
steps to verify for the user that you cannot accomplish yourself. Use provided
tools as these:

- `npm run test` to run unittests
- `npm run lint` to lint the code
- `npm run typecheck` to check types
- If installed and applicable use `playwright-cli` to test the
