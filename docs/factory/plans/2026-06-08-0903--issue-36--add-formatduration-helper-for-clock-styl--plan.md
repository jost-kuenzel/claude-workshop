---
issue: 36
spec: docs/factory/specs/2026-06-08-1100--issue-36--format-duration--design.md
---

# formatDuration Helper Implementation Plan

**Goal:** Add a pure `formatDuration(ms)` export to `tools/factory/lib/claude.ts` and wire it into `resultSummary` so factory run summaries show `HH:MM:SS` instead of a raw seconds count.

**Architecture:** `formatDuration` is a pure total function placed near the existing `truncate` helper in `claude.ts`; it accepts milliseconds, rounds to the nearest second, decomposes via divmod, and returns a zero-padded `HH:MM:SS` string. `resultSummary` already builds a `parts` array — the duration part is replaced by calling `formatDuration(ev.duration_ms)` when `duration_ms` is present.

**Tech Stack:** TypeScript, Bun test runner (`bun test`), no new dependencies.

## Task Checklist

- [ ] Task 1: Implement `formatDuration` with tests
- [ ] Task 2: Wire `formatDuration` into `resultSummary` and update its test

---

### Task 1: Implement `formatDuration` with tests

**Files:**

- Modify: `tools/factory/lib/claude.ts`
- Modify: `tools/factory/lib/__tests__/claude.test.ts`

- [ ] Step 1: Add a `describe("formatDuration")` block to `tools/factory/lib/__tests__/claude.test.ts`.

  Add the import of `formatDuration` to the existing import at the top of the file:

  ```ts
  import {
    buildClaudeArgs,
    CI_SANDBOX,
    resolveAuthEnv,
    logPath,
    extractResult,
    clockNow,
    groupHeader,
    GROUP_FOOTER,
    truncate,
    toolSummary,
    formatEvent,
    resultSummary,
    formatDuration, // ← add this
  } from "../claude";
  ```

  Then add the test describe block (can go anywhere after the existing `describe("truncate", ...)` block):

  ```ts
  describe("formatDuration", () => {
    test("0 ms → 00:00:00", () => {
      expect(formatDuration(0)).toBe("00:00:00");
    });
    test("42000 ms → 00:00:42", () => {
      expect(formatDuration(42000)).toBe("00:00:42");
    });
    test("580000 ms → 00:09:40", () => {
      expect(formatDuration(580000)).toBe("00:09:40");
    });
    test("3661000 ms → 01:01:01 (hours + minutes + seconds)", () => {
      expect(formatDuration(3661000)).toBe("01:01:01");
    });
    test("rounding: 1500 ms rounds to 2 s → 00:00:02", () => {
      expect(formatDuration(1500)).toBe("00:00:02");
    });
    test("rounding: 59600 ms rounds up to 60 s → 00:01:00 (crosses minute boundary)", () => {
      expect(formatDuration(59600)).toBe("00:01:00");
    });
    test("360000000 ms → 100:00:00 (hours grow past 2 digits)", () => {
      expect(formatDuration(360000000)).toBe("100:00:00");
    });
    test("negative input → 00:00:00", () => {
      expect(formatDuration(-5)).toBe("00:00:00");
    });
    test("NaN → 00:00:00", () => {
      expect(formatDuration(NaN)).toBe("00:00:00");
    });
    test("Infinity → 00:00:00", () => {
      expect(formatDuration(Infinity)).toBe("00:00:00");
    });
  });
  ```

- [ ] Step 2: Run the tests and confirm they all **fail** (the export doesn't exist yet):

  ```
  bun test tools/factory/lib/__tests__/claude.test.ts
  ```

  Expected: compile error or import failure for `formatDuration`.

- [ ] Step 3: Add the `formatDuration` export to `tools/factory/lib/claude.ts`. Place it directly after the existing `truncate` function (around line 107):

  ```ts
  /** Pure: format a millisecond duration as HH:MM:SS (hours grow past 2 digits for long runs). */
  export function formatDuration(ms: number): string {
    if (!Number.isFinite(ms) || ms < 0) return "00:00:00";
    const total = Math.round(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const p2 = (n: number) => String(n).padStart(2, "0");
    return `${String(h).padStart(2, "0")}:${p2(m)}:${p2(s)}`;
  }
  ```

- [ ] Step 4: Run the tests again and confirm they all **pass**:

  ```
  bun test tools/factory/lib/__tests__/claude.test.ts
  ```

  Expected: all `formatDuration` tests green; no regressions in existing tests.

- [ ] Step 5: Run lint and typecheck:

  ```
  bun run lint && bun run typecheck
  ```

  Expected: no errors.

- [ ] Step 6: Commit:

  ```
  git add tools/factory/lib/claude.ts tools/factory/lib/__tests__/claude.test.ts
  git commit -m "feat: add formatDuration helper with HH:MM:SS clock-style output"
  ```

---

### Task 2: Wire `formatDuration` into `resultSummary` and update its test

**Files:**

- Modify: `tools/factory/lib/claude.ts`
- Modify: `tools/factory/lib/__tests__/claude.test.ts`

**Context:** After Task 1, `tools/factory/lib/claude.ts` exports `formatDuration(ms: number): string` which returns a zero-padded `HH:MM:SS` string (e.g. `formatDuration(42000)` → `"00:00:42"`). This task replaces the raw-seconds computation in `resultSummary` with a call to that function.

- [ ] Step 1: In `tools/factory/lib/__tests__/claude.test.ts`, update the existing `resultSummary` success-case test. Change the expectation from `"✓ Task 2 · 8 turns · 42s · $0.21"` to `"✓ Task 2 · 8 turns · 00:00:42 · $0.21"`:

  ```ts
  describe("resultSummary", () => {
    test("renders a success line with turns, duration and cost", () => {
      const ev = {
        type: "result",
        subtype: "success",
        num_turns: 8,
        duration_ms: 42000,
        total_cost_usd: 0.21,
      };
      expect(resultSummary("Task 2", ev)).toBe("✓ Task 2 · 8 turns · 00:00:42 · $0.21");
    });
    test("marks non-success outcomes with ✗", () => {
      const ev = { type: "result", subtype: "error_max_turns", num_turns: 50 };
      expect(resultSummary("Task 2", ev)).toBe("✗ Task 2 · 50 turns");
    });
  });
  ```

  The failure-case test (no `duration_ms`) is unchanged.

- [ ] Step 2: Run the updated test and confirm it **fails** (the implementation still uses the old `${secs}s` format):

  ```
  bun test tools/factory/lib/__tests__/claude.test.ts
  ```

  Expected: the success-case test fails with `"42s"` vs `"00:00:42"`.

- [ ] Step 3: In `tools/factory/lib/claude.ts`, update `resultSummary` to use `formatDuration`. Replace these two lines inside `resultSummary`:

  ```ts
  const secs = typeof ev?.duration_ms === "number" ? Math.round(ev.duration_ms / 1000) : undefined;
  ```

  and the part entry:

  ```ts
  secs !== undefined ? `${secs}s` : null,
  ```

  with:

  ```ts
  const duration = typeof ev?.duration_ms === "number" ? formatDuration(ev.duration_ms) : undefined;
  ```

  and the part entry:

  ```ts
  duration !== undefined ? duration : null,
  ```

  The full updated `resultSummary` function should look like:

  ```ts
  export function resultSummary(label: string, ev: any): string {
    const ok = ev?.subtype === "success" && !ev?.is_error;
    const turns = ev?.num_turns;
    const duration =
      typeof ev?.duration_ms === "number" ? formatDuration(ev.duration_ms) : undefined;
    const cost = typeof ev?.total_cost_usd === "number" ? ev.total_cost_usd.toFixed(2) : undefined;
    const parts = [
      turns !== undefined ? `${turns} turns` : null,
      duration !== undefined ? duration : null,
      cost !== undefined ? `$${cost}` : null,
    ].filter(Boolean);
    return `${ok ? "✓" : "✗"} ${label}${parts.length ? " · " + parts.join(" · ") : ""}`;
  }
  ```

- [ ] Step 4: Run all tests and confirm they **pass**:

  ```
  bun test tools/factory/lib/__tests__/claude.test.ts
  ```

  Expected: all tests green, including the updated success-case assertion and both `formatDuration` tests from Task 1 (those remain in the file).

- [ ] Step 5: Run lint and typecheck:

  ```
  bun run lint && bun run typecheck
  ```

  Expected: no errors.

- [ ] Step 6: Commit:

  ```
  git add tools/factory/lib/claude.ts tools/factory/lib/__tests__/claude.test.ts
  git commit -m "feat: wire formatDuration into resultSummary for clock-style run timings"
  ```
