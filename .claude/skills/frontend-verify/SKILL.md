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
- **Always prefix every `bunx playwright-cli` command with
  `PLAYWRIGHT_BROWSERS_PATH="$PWD/.playwright-browsers"`** — like this:

  ```bash
  PLAYWRIGHT_BROWSERS_PATH="$PWD/.playwright-browsers" bunx playwright-cli open --browser=chromium http://localhost:3000/<route>
  ```

  Why, exactly: the CI workflow installs Chromium into `.playwright-browsers` at the
  repo root (the one path that stays **writable** inside the OS sandbox). The
  `playwright-cli` daemon writes its working dir to `$PLAYWRIGHT_BROWSERS_PATH/daemon`,
  so this also keeps the daemon on a writable path. The default `~/.cache/ms-playwright`
  is **read-only** in the sandbox (even `touch` fails), and that env var is **not**
  inherited from the workflow — so if you don't set it inline on each call, the daemon
  dies with `mkdir .../daemon: Read-only file system`. Set it on **every** call
  (`open`, `snapshot`, `console`, `screenshot`, `close`, `kill-all`); env does not
  persist between your Bash calls.

- Do **not** rabbit-hole on alternatives (`PLAYWRIGHT_DAEMON_SESSION_DIR`, symlinking
  `~/.cache`, `--browser=chromium-headless-shell`, a custom executable path). The
  inline `PLAYWRIGHT_BROWSERS_PATH` above is the whole fix. **If the browser or daemon
  still will not start**, report **`BLOCKED`** with the error — do **not** hand-roll a
  raw `playwright` Node script (it bypasses the snapshot/console checks and produces
  misleading evidence).

## Flow

1. **Server up.** First **poll `:3000`** — a dev server may already be running from an
   earlier step in the same job. If it answers, **reuse it** (skip to step 2); do not
   start a second one (a second `bun run dev` collides on the port / a stale
   `.next` lock and wedges). Poll with a `bun -e` fetch loop (you have no
   `curl`/`sleep`, and this is one command, satisfying the one-command-per-Bash rule):

   ```bash
   bun -e 'for (let i = 0; i < 60; i++) { try { const r = await fetch("http://localhost:3000"); if (r.status) { console.log("up", r.status); process.exit(0); } } catch {} await new Promise(s => setTimeout(s, 1000)); } console.log("timeout"); process.exit(1)'
   ```

   If `:3000` does **not** answer, start the server, then re-run the poll above. **How**
   you launch it is what trips people up:
   - Launch `bun run dev` with the **Bash tool's `run_in_background: true` parameter** —
     the harness keeps that task alive across your _later_ Bash calls, which is exactly
     what you need (start it in one call, then poll and drive the browser in separate
     calls).
   - **Do NOT use a shell `&`, `nohup`, `disown`, or `setsid`.** Each Bash call runs in
     its own OS-sandbox invocation, and the sandbox **reaps the whole process tree the
     moment that foreground command returns** — so a shell-backgrounded `bun run dev &`
     is already dead before your next call polls it. This is the #1 reason the dev
     server "won't start." Only a harness-tracked background task survives.

   If `:3000` still never responds after launching, report `BLOCKED`/`NEEDS_CONTEXT` —
   do not fake a pass.

2. **Browser.** Open Chromium — `--browser=chromium` is **mandatory** (`open` runs
   headless by default, which is what CI needs):

   ```bash
   PLAYWRIGHT_BROWSERS_PATH="$PWD/.playwright-browsers" bunx playwright-cli open --browser=chromium http://localhost:3000/<route>
   ```

   A bare `open` picks the `chrome` channel (`/opt/google/chrome/chrome`) and fails;
   the `PLAYWRIGHT_BROWSERS_PATH` prefix is mandatory on every call (see above).

3. **Drive, then wait for the Outcome to actually render.** Navigate to where the
   `Outcome` is observable. The app's chrome is client-rendered: components like the
   sidebar nav and the signed-in user fetch `/api/auth/me` **after** hydration, so a
   screenshot taken at page-load can catch an empty, half-rendered, "not-logged-in"
   shell even when auth succeeded. Before trusting the page, **wait for a concrete,
   post-hydration element that proves the Outcome** — e.g. the actual footer/badge
   text, a sidebar nav link, or the user name — not just navigation/`networkidle`:

   ```bash
   PLAYWRIGHT_BROWSERS_PATH="$PWD/.playwright-browsers" bunx playwright-cli snapshot
   ```

   Confirm the Outcome's element (and, on an authenticated page, the auth-dependent
   chrome) is present in the snapshot. If it isn't there yet, the page is mid-hydration
   — wait and re-`snapshot` before proceeding.

4. **Console, filtered.** Check
   `PLAYWRIGHT_BROWSERS_PATH="$PWD/.playwright-browsers" bunx playwright-cli console`.
   Only **same-origin**
   (`localhost:3000`) errors count as a verification failure. **Foreign-origin**
   entries (external APIs, CDNs) are noise — ignore them, so verification does not fail
   on calls outside the app.

5. **Result.** Outcome present and no same-origin console errors → verified. Otherwise
   red → fix the code and retry from step 2. After ~3 unproductive rounds, report
   `BLOCKED` (the existing escalation contract).

6. **Teardown (mandatory, green or red).** Always close the browser and stop the
   background dev-server task you started in step 1:

   ```bash
   PLAYWRIGHT_BROWSERS_PATH="$PWD/.playwright-browsers" bunx playwright-cli close
   ```

   Then stop the dev server so a later task can rebind `:3000` cleanly. Kill the
   background task you launched **and** any lingering Next worker — `pkill -f next`
   (broader than `next dev`, which only matches the launcher, not the `next-server`
   worker that actually holds the port). Never leave an orphaned dev server or browser
   session behind.

## Evidence variant

When the task is the **evidence task** (capture the curated screenshot), the flow is
the same through step 3 — **including the wait for the Outcome's element to actually
render** (step 3); a screenshot of a mid-hydration shell is misleading evidence, not
proof. Then, instead of console-checking, write the screenshot straight to the tracked
path and commit it:

```bash
PLAYWRIGHT_BROWSERS_PATH="$PWD/.playwright-browsers" bunx playwright-cli screenshot --filename=docs/factory/evidence/issue-<N>/<slug>.png
git add docs/factory/evidence/issue-<N>/<slug>.png
git commit -m "evidence: screenshot for issue <N>"
```

Then tear down (step 6). If the route 404s, the shot is empty, or the Outcome's
element never rendered, fail — do **not** commit a broken or half-rendered artifact.
