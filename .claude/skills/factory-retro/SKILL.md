---
name: factory-retro
description: Mine a factory workflow run's logs for learnings and turn them into concrete factory improvements. Use this skill WHENEVER the user wants to learn from, review, retro, or post-mortem a factory CI run — e.g. "why did that factory run take so long", "what can we improve from the last run", "analyze the factory logs", "learn from run <id>", "codify learnings from that build". Each factory-go / factory-revise run uploads a logs artifact and emits per-phase timing/cost; this skill reads that evidence, finds friction (allow-list gaps, brute-force thrash, review round-trips), and routes each finding to its fix — an allow-list edit, a factory issue, or a docs refresh. Prefer this over eyeballing logs ad hoc, because it ties every finding to evidence and a destination.
---

# Factory Retro

Turn the exhaust of a factory run into durable improvements to the factory itself.

Every automated run (`factory-go`, `factory-revise`) leaves two kinds of evidence:

- **Rendered stdout** — visible via `gh run view <run-id> --log`. One collapsible
  group per phase, the tool calls inside it, `⚠️ tool error:` lines, and a
  always-visible outcome line per phase:
  `✓ <phase> · <N> turns · <secs>s · $<cost>`.
- **Raw stream-json artifact** — `factory-logs-<run-id>`, one
  `.factory/logs/<run-id>--<step>.jsonl` per phase. Each line is a stream-json
  event with the **full** tool input, tool_result errors, and a final `result`
  event carrying `num_turns`, `duration_ms`, `total_cost_usd`.

The rendered log is enough for most retros; pull the artifact when you need the
exact command that was blocked or the full error text.

The goal is not a write-up — it is **routed fixes**. Every finding ends at a
concrete destination: an allow-list edit, a factory issue, or a docs refresh.

## Process

### 1. Pick the run

If the user named a run, use it. Otherwise list recent ones and choose the
relevant build (usually the most recent `factory-go` for the feature in question):

```bash
gh run list --workflow factory-go.yml --limit 15 \
  --json databaseId,displayTitle,conclusion,createdAt,updatedAt,workflowName
```

`factory-revise` runs (re-runs triggered by a PR comment) are worth a retro too —
they often reveal what the first build got wrong.

### 2. Pull the logs

Start with the rendered log — it already separates phases and surfaces outcomes
and tool errors:

```bash
gh run view <run-id> --log > /tmp/retro.log
```

When you need the exact blocked command, the full error, or precise per-phase
numbers, download the raw artifact and read the per-step JSONL:

```bash
gh run download <run-id> -n factory-logs-<run-id> -D /tmp/retro-artifact
```

In the JSONL: `result` events give `duration_ms` / `total_cost_usd` / `num_turns`;
`assistant` events carry `tool_use` blocks with full `input`; `user` events carry
`tool_result` blocks where `is_error: true` is a failed/blocked call.

### 3. Build the phase ledger

One row per phase, in run order. This localizes the cost before you explain it.

| Phase           | Duration | Cost | Turns |
| --------------- | -------- | ---- | ----- |
| Plan generation | …        | …    | …     |
| Task N: <title> | …        | …    | …     |
| Finalize PR     | …        | …    | …     |

Flag the outlier(s) — the phase that dominates wall-clock or cost is where the
learning usually hides.

### 4. Hunt for friction signals

Scan every phase (the JSONL `is_error` results and the rendered `⚠️ tool error:`
lines) for these recurring shapes:

- **Permission blocks** — `requires approval`, `blocked`, `Output redirection …
was blocked`. Each one is an allow-list gap: the agent wanted a tool it wasn't
  granted, then retried or worked around it (wasted turns). Capture the exact
  command string — you need it to widen the right glob.
- **Brute-force / thrash** — many near-identical tool calls in one phase:
  throwaway `debugN` files, repeated greps into `node_modules`, the same command
  retried with small tweaks. This signals a **missing convention or setup** the
  agent had to rediscover from scratch (the expensive kind of finding).
- **Review round-trips** — a `changes-requested` cycle that sent the implementer
  back. One-off is fine; a _recurring_ class of finding is worth encoding in a
  reviewer or a skill so it never recurs.
- **Plain tool errors** — `EISDIR`, `pathspec … did not match`, etc. Usually
  small, but cheap to fix and they add up.

### 5. Triage each finding to a destination

Every finding gets a root cause, evidence (a `file:line` or a quoted log line),
and exactly one destination:

- **Allow-list / config gap → edit the source directly.** The tool allow-lists
  are TypeScript constants, one per phase:
  - Plan generation → `PLAN_TOOLS` in `tools/factory/plan-gen.ts`
  - Task implement/review loop → `TASK_TOOLS` in `tools/factory/task-run.ts`
  - Finalize PR → the **inline list in `tools/factory/workflow-go.ts`** _and_
    `FINALIZE_TOOLS` in `tools/factory/pr-finalize.ts` (the list is duplicated —
    change **both** or the gap persists in one path).
  - Revise → `REVISE_TOOLS` in `tools/factory/workflow-revise.ts`

  Entries are `Bash(<prefix>:*)` globs and match on the command **prefix**, so
  `Bash(git status:*)` does not cover `git -C <path> status`, and a pipe like
  `bun test | grep …` needs the piped segment (`grep`) allowed too. Prefer the
  narrowest read-only grant that removes the friction; don't broaden a mutating
  verb (e.g. avoid blanket `Bash(git:*)`) just to fix a read-only block. After
  editing, verify: `npx eslint tools/factory/<files>` and `bun test tools/factory`.

- **Process / convention gap → file a factory issue.** The expensive thrash
  findings (a missing test setup, an undocumented pattern) belong in the pipeline,
  not in an ad-hoc fix. **Invoke the `factory-issue` skill** to file it — never
  `gh issue create` directly; the pipeline depends on its format and labels.

- **Pipeline doc drift → refresh the guide.** If the run revealed the process
  guide is stale, use the `docs-factory` skill.

### 6. Produce the retro report

Skimmable, evidence-led. In order:

1. **Phase ledger** (the table from step 3) with the outlier flagged.
2. **Findings**, ranked by cost/impact. Each: _symptom → evidence (quote or
   `file:line`) → root cause → fix → destination_.
3. **Actions** — what you changed in this session (with paths) vs. what you
   propose (issues to file, edits to make). Be explicit about which is which.

### 7. Finishing

- Don't commit edits or file issues unless the user asks. When you do file an
  issue, route through `factory-issue`. When you commit, follow repo conventions.
- Keep the smallest-blast-radius fix as the default; flag anything you
  deliberately left alone and why (e.g. "self-healed on retry, broadening is
  riskier than the one wasted call").
