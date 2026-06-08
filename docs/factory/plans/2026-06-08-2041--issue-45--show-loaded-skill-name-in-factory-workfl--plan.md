---
issue: 45
spec: docs/factory/specs/2026-06-08-2236--issue-45--show-loaded-skill-name--design.md
---

# Show Loaded Skill Name in Factory Workflow Implementation Plan

**Goal:** Fix `TOOL_ARG_KEYS.Skill` in `tools/factory/lib/claude.ts` so that `toolSummary()` emits `🔧 Skill  <skill-name>` instead of the bare `🔧 Skill`.

**Architecture:** `toolSummary()` in `tools/factory/lib/claude.ts` looks up a tool's display argument by consulting `TOOL_ARG_KEYS[name]`. The key for `Skill` is currently `"command"`, but the Skill tool's actual input field is `"skill"`. Changing that single mapping causes both top-level and subagent skill invocations to display correctly, because `formatEvent()` already routes all `tool_use` blocks (regardless of nesting level) through the same `toolSummary()`.

**Tech Stack:** TypeScript, Bun runtime, `bun:test` test runner.

## Task Checklist

- [ ] Task 1: Fix TOOL_ARG_KEYS.Skill and add tests

---

### Task 1: Fix TOOL_ARG_KEYS.Skill and add tests

**Files:**

- Modify: `tools/factory/lib/claude.ts`
- Modify: `tools/factory/lib/__tests__/claude.test.ts`

**Context:** In `tools/factory/lib/claude.ts`, the constant `TOOL_ARG_KEYS` (around line 91) maps tool names to the input field that `toolSummary()` should display. The `Skill` entry currently reads `"command"`, but the Skill tool's actual input field is named `"skill"`. Changing it to `"skill"` makes `toolSummary()` pick up the skill name and emit `🔧 Skill  <skill-name>`.

The test file is at `tools/factory/lib/__tests__/claude.test.ts`. It uses `bun:test` (`import { test, expect, describe } from "bun:test"`). Run tests with `bun run test:unit`.

- [ ] Step 1: Add two failing tests

  Open `tools/factory/lib/__tests__/claude.test.ts`. Inside the existing `describe("toolSummary", ...)` block (around line 150), add this test after the last existing test:

  ```ts
  test("shows the skill name for Skill tool", () => {
    expect(toolSummary("Skill", { skill: "factory-plan" })).toBe("🔧 Skill  factory-plan");
  });
  ```

  Then inside the existing `describe("formatEvent", ...)` block, add this test after the last existing test:

  ```ts
  test("shows skill name with subagent prefix when Skill is used inside an agent", () => {
    const agents = new Map([["tu_1", "factory-implementer"]]);
    const ev = {
      type: "assistant",
      parent_tool_use_id: "tu_1",
      message: {
        content: [{ type: "tool_use", name: "Skill", input: { skill: "factory-plan" } }],
      },
    };
    expect(formatEvent(ev, agents)).toEqual(["      ↳ factory-implementer 🔧 Skill  factory-plan"]);
  });
  ```

- [ ] Step 2: Run tests and expect FAIL

  ```
  bun run test:unit
  ```

  Both new tests should fail:
  - `toolSummary("Skill", { skill: "factory-plan" })` returns `🔧 Skill` (no name), not `🔧 Skill  factory-plan`
  - The `formatEvent` subagent test returns `["      ↳ factory-implementer 🔧 Skill"]`, not the expected form with `factory-plan`

- [ ] Step 3: Apply the one-line fix

  Open `tools/factory/lib/claude.ts`. Find `TOOL_ARG_KEYS` (around line 91–101). Change the `Skill` entry from `"command"` to `"skill"`:

  ```ts
  // Before:
  Skill: "command",

  // After:
  Skill: "skill",
  ```

  No other changes needed — `toolSummary()` and `formatEvent()` already handle the rest.

- [ ] Step 4: Run tests and expect PASS

  ```
  bun run test:unit
  ```

  All tests should pass, including both new ones.

- [ ] Step 5: Lint and typecheck

  ```
  bun run lint && bun run typecheck
  ```

  Both should exit cleanly.

- [ ] Step 6: Commit

  ```
  git add tools/factory/lib/claude.ts tools/factory/lib/__tests__/claude.test.ts
  git commit -m "fix(factory): show skill name in toolSummary for Skill tool"
  ```
