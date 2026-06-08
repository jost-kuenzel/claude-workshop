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

2. **Browser.** Open Chromium — `--browser=chromium` is **mandatory**:

   ```bash
   playwright-cli open --browser=chromium http://localhost:3000/<route>
   ```

   A bare `open` picks the `chrome` channel (`/opt/google/chrome/chrome`) and fails.

3. **Drive.** Navigate to where the `Outcome` is observable and `snapshot` to confirm
   the Outcome is actually present in the rendered page (not just that the page loaded).

4. **Console, filtered.** Check `playwright-cli console`. Only **same-origin**
   (`localhost:3000`) errors count as a verification failure. **Foreign-origin**
   entries (external APIs, CDNs) are noise — ignore them, so verification does not fail
   on calls outside the app.

5. **Result.** Outcome present and no same-origin console errors → verified. Otherwise
   red → fix the code and retry from step 2. After ~3 unproductive rounds, report
   `BLOCKED` (the existing escalation contract).

6. **Teardown (mandatory, green or red).** Always:

   ```bash
   playwright-cli close
   kill <PID>
   ```

   Never leave an orphaned dev server or browser session behind.

## Evidence variant

When the task is the **evidence task** (capture the curated screenshot), the flow is
the same through step 3, then instead of console-checking, write the screenshot
straight to the tracked path and commit it:

```bash
playwright-cli screenshot --filename=docs/factory/evidence/issue-<N>/<slug>.png
git add docs/factory/evidence/issue-<N>/<slug>.png
git commit -m "evidence: screenshot for issue <N>"
```

Then tear down (step 6). If the route 404s or the shot is empty, fail — do **not**
commit a broken artifact.
