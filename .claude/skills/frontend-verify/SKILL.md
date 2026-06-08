---
name: frontend-verify
description: Verify application frontend work in a real Chromium browser via playwright-cli — start the dev server, drive to where the spec's Outcome is observable, check same-origin console errors, then tear down. Use when implementing or verifying a user-facing UI surface in the factory pipeline.
---

# Frontend Verify

The app-specific recipe for proving a frontend change actually renders in a real
browser — the visual counterpart to running tests. Used by `factory-implementer`
on tasks the plan annotated "self-verify in browser (frontend-verify)", and by the
evidence task. For the full command reference, see the `playwright-cli` skill — this
skill is only the app-specific flow and the gotchas the spike surfaced.

You verify against a spec's `## Verification` `Outcome` — the abstract user-visible
result. Derive the concrete route and navigation steps yourself; the spec does not
spell them out.

## Running playwright-cli

- Invoke it as **`bunx playwright-cli`** — in CI there is no global `playwright-cli`
  on `PATH` (a bare `playwright-cli` will be "command not found").
- The CI workflow presets **`PLAYWRIGHT_BROWSERS_PATH`** to a sandbox-writable path
  and installs Chromium there. **Do not override it.** `playwright-cli`'s daemon
  writes its working dir under that path; the default `~/.cache/ms-playwright` is
  read-only inside the sandbox. If — and only if — you hit
  `mkdir .../daemon: Read-only file system`, export `PLAYWRIGHT_BROWSERS_PATH` to a
  writable dir (e.g. under the repo) and retry.
- **If the browser or daemon will not start at all** (after the read-only-path retry
  above), report **`BLOCKED`** with the error. Do **not** hand-roll a raw `playwright`
  Node script as a workaround — that bypasses the verification contract (no snapshot,
  no console check) and produces misleading evidence.

## Flow

1. **Server up.** Start `bun run dev` in the **background** (the harness's
   background-run mechanism, NOT a shell `&`) and **remember its PID** — you need it
   for teardown. Then poll `:3000` until it answers, with a `bun -e` fetch loop (you
   have no `curl`/`sleep`, and this is one command, satisfying the one-command-per-Bash
   rule):

   ```bash
   bun -e 'for (let i = 0; i < 60; i++) { try { const r = await fetch("http://localhost:3000"); if (r.status) { console.log("up", r.status); process.exit(0); } } catch {} await new Promise(s => setTimeout(s, 1000)); } console.log("timeout"); process.exit(1)'
   ```

   If `:3000` never responds, report `BLOCKED`/`NEEDS_CONTEXT` — do not fake a pass.

2. **Browser.** Open Chromium — `--browser=chromium` is **mandatory** (`open` runs
   headless by default, which is what CI needs):

   ```bash
   bunx playwright-cli open --browser=chromium http://localhost:3000/<route>
   ```

   A bare `open` picks the `chrome` channel (`/opt/google/chrome/chrome`) and fails.

3. **Drive, then wait for the Outcome to actually render.** Navigate to where the
   `Outcome` is observable. The app's chrome is client-rendered: components like the
   sidebar nav and the signed-in user fetch `/api/auth/me` **after** hydration, so a
   screenshot taken at page-load can catch an empty, half-rendered, "not-logged-in"
   shell even when auth succeeded. Before trusting the page, **wait for a concrete,
   post-hydration element that proves the Outcome** — e.g. the actual footer/badge
   text, a sidebar nav link, or the user name — not just navigation/`networkidle`:

   ```bash
   bunx playwright-cli snapshot
   ```

   Confirm the Outcome's element (and, on an authenticated page, the auth-dependent
   chrome) is present in the snapshot. If it isn't there yet, the page is mid-hydration
   — wait and re-`snapshot` before proceeding.

4. **Console, filtered.** Check `bunx playwright-cli console`. Only **same-origin**
   (`localhost:3000`) errors count as a verification failure. **Foreign-origin**
   entries (external APIs, CDNs) are noise — ignore them, so verification does not fail
   on calls outside the app.

5. **Result.** Outcome present and no same-origin console errors → verified. Otherwise
   red → fix the code and retry from step 2. After ~3 unproductive rounds, report
   `BLOCKED` (the existing escalation contract).

6. **Teardown (mandatory, green or red).** Always:

   ```bash
   bunx playwright-cli close
   kill <PID>
   ```

   Never leave an orphaned dev server or browser session behind.

## Evidence variant

When the task is the **evidence task** (capture the curated screenshot), the flow is
the same through step 3 — **including the wait for the Outcome's element to actually
render** (step 3); a screenshot of a mid-hydration shell is misleading evidence, not
proof. Then, instead of console-checking, write the screenshot straight to the tracked
path and commit it:

```bash
bunx playwright-cli screenshot --filename=docs/factory/evidence/issue-<N>/<slug>.png
git add docs/factory/evidence/issue-<N>/<slug>.png
git commit -m "evidence: screenshot for issue <N>"
```

Then tear down (step 6). If the route 404s, the shot is empty, or the Outcome's
element never rendered, fail — do **not** commit a broken or half-rendered artifact.
