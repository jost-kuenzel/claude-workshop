---
name: format-duration
description: Pure formatDuration(ms) helper rendering clock-style HH:MM:SS, wired into resultSummary
status: draft
issue: 36
---

# formatDuration — clock-style run timings

## Problem

`resultSummary` in `tools/factory/lib/claude.ts` renders a run's elapsed time as a
raw seconds count (`` `${secs}s` ``), so a multi-minute factory run prints `580s`.
That is hard to scan. A fixed-width clock-style `HH:MM:SS` rendering (`00:09:40`) is
easier to read and aligns cleanly in the run summary.

## Approach

Add one pure, total helper `formatDuration(ms)` and wire it into `resultSummary`.
There is a single sensible approach (a pure divmod formatter) — no alternatives worth
weighing.

## Components

### `formatDuration(ms: number): string` (new export in `tools/factory/lib/claude.ts`)

Place near the existing `truncate` helper. Behavior:

- **Invalid-input guard:** if `!Number.isFinite(ms) || ms < 0`, return `"00:00:00"`.
  This keeps the function total so the logging path can never crash on a malformed
  `duration_ms`. (Covers negative, `NaN`, and `Infinity`.)
- **Rounding:** `const total = Math.round(ms / 1000)` — round to the nearest second.
- **Decompose:**
  - `h = Math.floor(total / 3600)`
  - `m = Math.floor((total % 3600) / 60)`
  - `s = total % 60`
- **Format:** minutes and seconds zero-padded to exactly 2 digits; hours zero-padded
  to a **minimum** of 2 digits but allowed to grow for very long runs
  (`String(h).padStart(2, "0")`). Return `` `${HH}:${MM}:${SS}` ``.

Examples: `0 → "00:00:00"`, `42000 → "00:00:42"`, `580000 → "00:09:40"`,
`3661000 → "01:01:01"`, `360000000 → "100:00:00"`.

### Wiring in `resultSummary` (`tools/factory/lib/claude.ts`)

Replace the raw-seconds computation and its use in the `parts` array:

- Current: `const secs = typeof ev?.duration_ms === "number" ? Math.round(ev.duration_ms / 1000) : undefined;`
  and the part `secs !== undefined ? `${secs}s` : null`.
- New: compute the duration part as `formatDuration(ev.duration_ms)` only when
  `typeof ev?.duration_ms === "number"` (else the part is omitted, exactly as today).

Everything else in `resultSummary` — the `✓`/`✗` ok marker, `turns`, `cost`, and the
`· ` joining — stays unchanged.

## Data flow

`resultSummary` is called with a parsed result event `ev`. `ev.duration_ms` (a number
of milliseconds, when present) flows into `formatDuration`, which returns the
`HH:MM:SS` string spliced into the existing `parts` join. No I/O, no shared state.

## Error handling

`formatDuration` is pure and total: it never throws. Invalid/non-finite/negative input
clamps to `"00:00:00"`. `resultSummary` keeps its existing tolerance — when
`duration_ms` is absent or non-numeric, the duration part is simply omitted.

## Testing (TDD)

Add tests in `tools/factory/lib/__tests__/claude.test.ts`.

New `describe("formatDuration")`:

- `0` → `"00:00:00"`
- `42000` → `"00:00:42"`
- `580000` → `"00:09:40"`
- `3661000` → `"01:01:01"` (hours + minutes + seconds)
- rounding: `1500` → `"00:00:02"`; `59600` → `"00:01:00"` (rounds up across the
  minute boundary)
- very long: `360000000` → `"100:00:00"` (hours grow past 2 digits)
- invalid: `-5`, `NaN`, `Infinity` → `"00:00:00"`

Update the existing `resultSummary` success-case test: the expectation changes from
`"✓ Task 2 · 8 turns · 42s · $0.21"` to `"✓ Task 2 · 8 turns · 00:00:42 · $0.21"`
(the event's `duration_ms` is `42000`). The failure-case test (no `duration_ms`)
is unchanged.

## Non-goals

- No change to how `duration_ms` is sourced or to any other field in `resultSummary`.
- No new config or formatting options (always `HH:MM:SS`). YAGNI.
- No unrelated refactoring of `claude.ts`.
