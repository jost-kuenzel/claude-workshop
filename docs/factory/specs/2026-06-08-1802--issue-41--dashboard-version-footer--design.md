---
name: dashboard-version-footer
description: Add a small static version footer to the dashboard layout, visible on every dashboard page, as a trivial UI surface that exercises the factory's browser-verify and screenshot-evidence loop.
status: draft
issue: 41
---

# Dashboard version footer

## Summary

Add a small, static version footer — `ACME CRM v1.0.0` — to the dashboard layout so
it appears on every dashboard page (dashboard, customers, users). It is a single
piece of static text; its real purpose is to be a trivial, self-contained user-facing
UI surface that drives the factory's new browser-verify + screenshot-evidence loop
end to end.

## Goals

- A version footer is visible at the bottom of every page rendered inside the
  dashboard layout.
- The footer text is a static string; no build-time or runtime version wiring.
- The footer is unobtrusive — muted, small, and never overlapping page content.

## Non-goals (YAGNI)

- Deriving the version from `package.json`, git, or any build step — the string is
  hard-coded for this demo.
- A footer on non-dashboard surfaces (login, marketing). Dashboard layout only.
- Links, build metadata, or any interactivity.

## Architecture

The dashboard layout (`src/app/(dashboard)/layout.tsx`) already wraps every dashboard
page with a sidebar, a navbar, and a `<main>` content region. The footer is one more
element in that shared layout column, placed after the content region so it renders
once per page, below the content, for all dashboard routes. Follow the existing
layout's structure and the repo's Tailwind utility-class styling; keep the footer a
small, muted, presentational element with no state.

## Data flow

None — the footer renders a constant string. No props, fetches, or state.

## Error handling

None applicable — static presentational text has no failure modes.

## Testing

- A component test (Vitest, `*.test.tsx`) asserts the dashboard layout renders the
  version footer text, following the repo's existing component-test patterns.
- Keep everything green: `bun run test`, `bun run lint`, `bun run typecheck`.
- The user-facing result is confirmed in a browser per the Verification section below.

## Verification

UI surface: yes
Outcome: After signing in, every dashboard page shows a small, muted version footer
reading "ACME CRM v1.0.0" at the bottom of the layout, below the page content and not
overlapping it.
