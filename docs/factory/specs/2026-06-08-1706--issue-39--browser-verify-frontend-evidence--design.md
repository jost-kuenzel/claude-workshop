---
name: browser-verify-frontend-evidence
description: Teach the factory to browser-verify application frontend work with playwright-cli and attach a screenshot of the finished feature inline in the PR, gated by a spec-declared UI surface.
status: draft
issue: 39
---

# Factory: browser-verify frontend work and attach screenshot evidence to the PR

## Summary

Today the factory verifies work with lint + tests + read-only reviewers. Nothing
proves the application UI actually renders, and any browser artifacts land in the
gitignored `.playwright-cli/` and are lost after the run.

This capability adds two distinct things, kept deliberately separate:

1. **Work verification** — the `factory-implementer` learns to verify application
   frontend work in a real browser (Chromium via `playwright-cli`), the same way it
   already runs tests. This is a capability (a skill), used in its own fix loop.
2. **Evidence** — a dedicated plan-task captures one curated screenshot of the
   finished feature into a tracked directory; `pr-finalize` embeds it inline in the
   PR body so a reviewer sees durable, visible proof.

Both fire **only when the work exposes a user-facing UI surface**, decided once in
the spec and inherited downstream — never for factory/infra code or backend-only
changes.

## Goals

- A spec-declared **UI-surface gate** that flows unchanged through the pipeline
  (brainstorm declares → plan enforces → implementer verifies → pr-finalize embeds).
- The implementer self-verifies frontend work in Chromium, with mandatory teardown.
- One curated screenshot per UI feature, committed to the branch and shown inline
  in the PR.

## Non-goals (YAGNI)

- **Auto-detect safety net** (changed-paths heuristic). The spec-declared gate is the
  single source of truth. Possible future addition as an optional warning only.
- **Hard enforcement gate** (a Stop-hook that blocks until browser-verify is green).
  v1 is a capability via skill, like running tests. Future hardening.
- **Video / tracing / PDF** artifacts — one screenshot is the evidence.
- **Commit-SHA-permanent evidence URLs** and **multi-shot galleries** — just the
  screenshot(s) the spec's `Outcome` implies.
- **Widening the external network allowlist** beyond the application's own API.

## Architecture — the gate contract

The UI-surface signal is declared **once in the spec** and flows unchanged through
the pipeline. No component re-decides; each inherits and acts.

### The `## Verification` spec section

Every spec carries this section. Its shape:

```
## Verification
UI surface: yes | no
# only when yes:
Outcome: <the user-visible result that, observed in a browser, proves the feature
          works — described abstractly, not as routes or click steps>
```

The section stays **abstract on purpose**: it declares _what_ should be true and _what
outcome_ proves it, not _how_ to reach it. Concrete routes, selectors, and navigation
steps are an implementation concern — `factory-plan` and the implementer derive them
(and routes may not even exist yet at spec time). A spec must not over-constrain the
plan's freedom.

`UI surface: no` is the default for factory/infra code and backend-only work; the
section ends there. (This very spec is factory code → its own `## Verification` is
`no`, so the capability builds itself without Playwright — a consistency check.)

### Who does what along the chain

| Component             | Role at the gate                                                                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `factory-brainstorm`  | **Raises** the gate: asks the UI-surface question in the dialogue; on `yes`, captures the abstract Outcome; writes the `## Verification` section into the spec.                              |
| `factory-plan`        | **Enforces**: reads the section. On `yes` → (a) annotate the frontend impl tasks with "self-verify in browser (frontend-verify)", (b) emit **one** evidence task at the end. On `no` → none. |
| `factory-implementer` | **Self-verifies** annotated tasks via the `frontend-verify` skill.                                                                                                                           |
| Evidence task         | Produces the committed screenshot.                                                                                                                                                           |
| `pr-finalize`         | **Embeds** the screenshot inline in the PR body.                                                                                                                                             |

**Enforcement nature.** As elsewhere in the factory, "enforced by `factory-plan`"
means via skill instructions to the planning model, **not** a new deterministic
parser. `lib/plan.ts` still parses only the `## Task Checklist` for task iteration;
the evidence task is an ordinary checkbox line. The `factory-plan-reviewer` checks in
its review loop that the gate was applied correctly. This keeps the change
lightweight and factory-native.

## Components

### 1. `frontend-verify` skill (new) — `.claude/skills/frontend-verify/SKILL.md`

The app-specific recipe, preloaded into `factory-implementer` like `factory-tdd`.
Refers to the existing `playwright-cli` skill for command reference (no duplication).
The flow, with the spike findings baked in:

1. **Server up:** start `bun run dev` in the background, **remember the PID**, poll
   `:3000` until it returns 200.
2. **Browser:** `playwright-cli open --browser=chromium <route>`. `--browser=chromium`
   is **mandatory** — a bare `open` picks the `chrome` channel
   (`/opt/google/chrome/chrome`) and fails.
3. **Drive:** navigate to where the spec's `Outcome` is observable (the concrete
   route/steps the implementer derives); `snapshot` to confirm the Outcome is present.
4. **Console, filtered:** only **same-origin** errors (`localhost:3000`) count as a
   verification failure; **foreign-origin** entries (e.g. external APIs) are ignored,
   so verification does not fail on noise.
5. **Result:** green → verified; red → fix and retry from step 2 (the loop stays in
   the implementer).
6. **Teardown (mandatory):** `playwright-cli close` **and** kill the dev-server by the
   remembered PID — no orphaned process, whether green or red.

### 2. Implementer plumbing — `.claude/agents/factory-implementer.md`

- `skills:` → `factory-tdd, frontend-verify`.
- `tools:` add `Bash(playwright-cli:*)`, `Bash(bunx playwright-cli:*)`,
  `Bash(npx playwright-cli:*)`, and **`Bash(kill:*)`** (targeted kill by PID for
  teardown). `bun run dev` is already covered by `Bash(bun:*)`.
- **Backgrounding / readiness polling:** start `bun run dev` via the harness's
  background-run mechanism (not a shell `&`). The implementer has no `curl`/`sleep`, so
  poll `:3000` with a `bun -e` fetch loop (covered by `Bash(bun:*)`) — a single command,
  fitting the "one command per Bash call" rule. (Note: under `CI_SANDBOX`
  (`bypassPermissions`) the tool allowlist is moot anyway, so chaining would also work in
  CI; the one-command rule only constrains local allowlist-enforced runs.)

### 3. Sandbox network — `tools/factory/ci.settings.json`

- Add the application's own data API **`thesimpsonsapi.com`** to the `allowedDomains`
  array so verified pages render with real data in CI. That array is all
  `ci.settings.json` supports — do **not** invent other config keys. Allowing the host
  should also clear the `ERR_CERT_AUTHORITY_INVALID` seen when it was blocked (a blocked
  host is proxy-intercepted; an allowed one connects directly), but that is sandbox-proxy
  behavior, not a config field — confirm on the first CI run.
- **localhost validation:** the dev server runs on `localhost:3000` (intra-sandbox via
  the socat proxy). The process guide implies `playwright-cli` is meant to run against
  the local frontend, so localhost should work. Treat this as a **validation step on
  the first CI run** — if localhost does not pass, add a localhost allowance. Do **not**
  otherwise widen the external allowlist; verified routes must render without blocked
  foreign calls (the `/login` page did so in the spike despite a blocked external API).

Browser provisioning stays the workflows' job — both `factory-go.yml` and
`factory-revise.yml` already install Chromium (`install-browser chromium --with-deps`).
The agent installs nothing. Local one-time setup (network-policy allow +
`playwright install`) is a documentation note, not code.

### 4. `factory-brainstorm` — raise the gate

The brainstorm dialogue gains the UI-surface question. On `yes`, it captures the
abstract Outcome and writes the `## Verification` section into the spec — no routes or
click steps. On `no`, the section is just `UI surface: no`. The
`factory-brainstorm-reviewer` confirms the section is present and well-formed.

### 5. `factory-plan` — enforce the gate

The planning instructions read the spec's `## Verification` section. On `UI surface:
yes`: annotate the frontend implementation tasks with a "self-verify in browser via
frontend-verify" expectation, and emit **one** evidence task at the end (see below).
On `no`: emit neither. The `factory-plan-reviewer` verifies correct application.

### 6. Evidence task + tracked directory

- **Directory:** `docs/factory/evidence/issue-<N>/` — outside the gitignored paths
  (`.factory/`, `.playwright*/`), so it is committed normally. Descriptive filename,
  e.g. `<slug>.png`.
- **The task** (emitted by `factory-plan` only on `UI surface: yes`, as the final
  checklist line) runs on the integrated final state via the normal
  `factory-implementer` (which now has `frontend-verify` + Playwright tools):
  1. server up, navigate to where the `Outcome` is observable (as in the skill),
  2. `playwright-cli screenshot --filename=docs/factory/evidence/issue-<N>/<slug>.png`
     (writes straight to the tracked path),
  3. `git add` + commit, then teardown.
- **Non-TDD framing:** this task has no testable unit. Resolved purely by task
  wording — `factory-plan` phrases it as "evidence capture, not test-first: produce
  the screenshot artifact." No special-casing of the test-gate is needed (a screenshot
  commit breaks neither lint nor tests); the spec/quality reviewers accept "screenshot
  produced + committed" as compliant, and the crisp acceptance prevents a "no tests"
  flag.
- **Self-review note:** the implementer's self-review "Testing — TDD followed" bullet
  must not flag this task. `factory-plan` states the TDD exemption in the task wording so
  the implementer does not return a spurious `DONE_WITH_CONCERNS`.

### 7. `pr-finalize` embedding — `tools/factory/pr-finalize.ts`

`pr-finalize` is **agent-driven**: `buildFinalizePrompt(prNumber, plan)` returns a
natural-language prompt and a Claude agent edits the PR body via `gh pr edit`. There is
**no** TypeScript that rewrites the body, scans directories, or builds URLs. So evidence
embedding is added by **extending the prompt**, not by new body-building code.

- Extend `buildFinalizePrompt` to also take the **issue number** and instruct the agent:
  "If any images exist under `docs/factory/evidence/issue-<N>/`, append a
  `## Verification evidence` section to the PR body, embedding each image via its
  absolute raw URL on this branch." The agent already has `gh` + branch/owner/repo
  context and reads the directory at runtime; it constructs:

```
## Verification evidence
![<Outcome>](https://raw.githubusercontent.com/<owner>/<repo>/<branch>/docs/factory/evidence/issue-<N>/<slug>.png)
```

(`<branch>` = `factory/issue-<N>--<slug>`.) GitHub renders PR-body images only via an
absolute URL, hence the raw form. No images → the agent adds nothing (backend/factory
specs untouched). `workflow-go.ts` passes the issue number it already holds into
`buildFinalizePrompt`.

- Durability note: the branch URL resolves while the branch exists (i.e. during review —
  fine); after merge the image lives on in the merge commit on `main`. A commit-SHA URL
  would be more permanent but is YAGNI for v1.

## Data flow

```
spec (## Verification: yes, Outcome — abstract)
  └─ factory-plan reads it; derives concrete routes/steps
       ├─ frontend impl tasks  ── annotated "self-verify (frontend-verify)"
       │     └─ factory-implementer: dev server → chromium → drive → filtered console → teardown
       └─ evidence task (final) ── screenshot → docs/factory/evidence/issue-N/ → commit
            └─ pr-finalize ── agent scans dir → embeds raw-URL image under "## Verification evidence"
```

## Error handling

| Case                                                          | Behavior                                                                                                |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Dev server won't start / `:3000` never responds               | Implementer reports `BLOCKED`/`NEEDS_CONTEXT`; no screenshot, no green lie.                             |
| Same-origin console error, or Outcome not visible in snapshot | Verification red → fix and retry; after ~3 rounds `BLOCKED` (existing escalation contract).             |
| Browser missing (provisioning failed)                         | Hard fail with a clear message — installing is not the agent's job.                                     |
| localhost blocked in the sandbox                              | Surfaces on the first CI run; the validation step in component 3 covers it.                             |
| Evidence task: route 404 / empty shot                         | Fail; do **not** commit a broken artifact.                                                              |
| Spec says `UI surface: yes` but no image exists               | `pr-finalize` defensively omits the section — the _missing_ screenshot is the visible signal in review. |

## Testing

- The only deterministic code is the **prompt** built by `buildFinalizePrompt`. Unit-test
  it the way the repo already tests prompt builders (`buildFrontmatter`, `buildTaskPrompt`,
  `buildPrompt`): assert the returned prompt contains the evidence-embedding instruction
  and the correct `docs/factory/evidence/issue-<N>/` path. The actual directory scan +
  raw-URL construction is the agent's runtime job (it has `gh`/`Read`), not unit-tested TS.
- Skill / agent / spec-section changes are prose → not unit-testable; covered by the
  brainstorm/plan reviewers and the first real CI run.
- Keep everything green: `bun run test`, `bun run lint`, `bun run typecheck`.
- End-to-end proof is the demo-feature run that follows this capability (separate issue).

## Verification

UI surface: no
</content>
</invoke>
