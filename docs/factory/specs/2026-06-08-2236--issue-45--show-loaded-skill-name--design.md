---
name: show-loaded-skill-name
description: Surface the loaded skill's name in factory workflow output, for both top-level and subagent contexts
status: draft
issue: 45
---

# Show loaded skill name in factory workflow output

## Problem

In the factory `workflow-*` output, a loaded skill renders as a bare `🔧 Skill`
with no indication of which skill was loaded. This is uninformative — neither the
top-level run nor a subagent within it reveals the skill, making logs harder to
follow and debug.

Root cause: in `tools/factory/lib/claude.ts`, `TOOL_ARG_KEYS` maps `Skill` to
`"command"`, but the Skill tool's input field is `skill`. The looked-up arg is
therefore always absent, so `toolSummary()` falls back to the bare `🔧 Skill`.

## Outcome

A loaded skill renders with its name, e.g. `🔧 Skill  which-skill`. The same
holds inside a subagent, where the line carries the existing `↳ <agent>` prefix:
`↳ <agent> 🔧 Skill  which-skill`.

## Design

Single-line fix: correct the `Skill` entry in `TOOL_ARG_KEYS`
(`tools/factory/lib/claude.ts`) from `"command"` to `"skill"`, matching the Skill
tool's actual input field. `toolSummary()` then picks up the skill name and emits
`🔧 Skill  <skill-name>`.

The subagent case needs no separate code path: `formatEvent()` routes both
top-level and subagent `tool_use` blocks through the same `toolSummary()`, so the
corrected mapping surfaces the name in both contexts. This shared path is an
existing guarantee the fix relies on, so it is locked in by a test (below) rather
than new code.

## Components

- `tools/factory/lib/claude.ts` — `TOOL_ARG_KEYS.Skill`: `"command"` → `"skill"`.
  No change to `toolSummary()` or `formatEvent()`.

## Error handling

No new failure modes. `toolSummary()` already tolerates a missing/non-string arg
by falling back to the bare `🔧 <name>` form, so a malformed Skill block degrades
to today's behaviour rather than throwing.

## Testing

In `tools/factory/lib/__tests__/claude.test.ts`:

- `toolSummary`: a `Skill` block with `{ skill: "factory-plan" }` renders
  `🔧 Skill  factory-plan`.
- `formatEvent`: a skill `tool_use` whose event carries a `parent_tool_use_id`
  mapped to an agent renders the skill name with the `↳ <agent>` prefix — locking
  in the subagent guarantee so a future regression is caught. Assert the exact
  prefixed form `formatEvent` emits (six leading spaces, as in the existing
  subagent-prefix test), e.g. `      ↳ factory-implementer 🔧 Skill  factory-plan`.

## Non-goals (YAGNI)

- Not rendering the skill `args`, only the skill name (matches the issue).
- No other `TOOL_ARG_KEYS` entries touched.

## Verification

UI surface: no
