---
name: Factory CI on the devcontainer image + auto-mode cutover
description: SP2 — run the factory (factory-go / factory-revise) inside the SP1 egress-firewalled devcontainer image, published to a private repo-named GHCR image, and cut the CI permission model from bypassPermissions to auto. Distilled from the issue #52 design §6/§6a/§8/§10. SP3 (the &&/allowlist cleanup) is out of scope.
status: draft
issue: 54
---

# Factory CI on the Devcontainer Image + Auto-Mode Cutover — Design (SP2)

- **Date:** 2026-06-12 12:35
- **Status:** Draft (decisions locked; not yet implemented)
- **Author:** Jost Künzel (with Claude)
- **Issue:** #54 — follow-up to closed #52 / PR #53 (SP1)
- **Parent design:** `docs/factory/specs/2026-06-09-1018--issue-52--claude-devcontainer-sandbox--design.md`
  §6 (CI parity), §6a (SP3 — out of scope), §8 (limitations), §10 (open questions).
  Read that first; this spec is the buildable distillation of its §6.

---

## 1. Problem

SP1 shipped one egress-firewalled devcontainer image that Claude runs inside
**locally**. CI still runs the old way: `factory-go` / `factory-revise` install
`bubblewrap` + `socat` on the bare runner, relax an AppArmor sysctl, `curl |
bash` the Claude CLI, and run Claude with `--permission-mode bypassPermissions`
behind an OS sandbox whose egress allowlist lives in
`tools/factory/ci.settings.json`. That is a **second** boundary and a **second**
egress list that drift from the container.

**Goal:** the factory runs inside the _same_ image, with the _same_ firewall, and
a stronger permission model (`auto`). One image, one boundary, one egress list —
used locally and in CI.

## 2. Locked decisions

Carried from the SP1 design §6 and confirmed for this build:

1. **Full `auto` cutover** — not "port the container but keep bypassPermissions".
   `CI_SANDBOX.permissionMode` → `auto`.
2. **Private, repo-named GHCR image** — `ghcr.io/jost-kuenzel/claude-workshop-devcontainer`,
   **private**, pulled in CI via the job's `GITHUB_TOKEN`.
3. **Image tags:** `:latest` + `:<sha>`. Published on pushes to `main` that touch
   `.devcontainer/**`. Factory jobs pull `:latest`. A devcontainer change takes
   effect once it lands on `main` (acceptable — these changes are rare).
4. **Pin model `opus`** in `CI_SANDBOX` — guarantees auto-mode eligibility
   (requires Opus 4.6+ / Sonnet 4.6) and is deterministic against a future
   subscription-default change. The `opus` alias always resolves to a current,
   auto-eligible Opus.
5. **Auto-mode config: minimal + reactive.** Seed only `autoMode.environment`
   prose (the repo + `thesimpsonsapi.com`) and keep `"$defaults"` for the
   `allow`/`soft_deny`/`hard_deny` lists. Add `allow` entries reactively as real
   runs surface false positives; monitor early runs for block-driven aborts.
6. **SP3 is out of scope** — the `&&`/pipe rule and agent allowlist cleanup
   (parent §6a) stay for a separate follow-up.

## 3. Where the auto-mode config lives (critical mechanism)

Per the [auto-mode config docs](https://code.claude.com/docs/en/auto-mode-config):
the classifier **does not read `autoMode` from shared project
`.claude/settings.json`** (a checked-in repo can't grant itself trust), **but it
does read it from the `--settings` flag file** ("`--settings` flag or Agent SDK —
per-invocation overrides for automation").

The factory already passes `tools/factory/ci.settings.json` via `--settings`
(it's `CI_SANDBOX.settings`). So that file is **repurposed, not emptied**: drop
the now-dead `sandbox` block, add the `autoMode` block. `CI_SANDBOX.settings`
stays wired; nothing else needs to learn a new path.

## 4. Deliverables

### 4.1 GHCR publish workflow — `.github/workflows/devcontainer-image.yml` (new)

- **Trigger:** `push` to `main` with `paths: ['.devcontainer/**']`; plus
  `workflow_dispatch` for manual rebuilds.
- **Permissions:** `contents: read`, `packages: write`.
- **Steps:** `docker/login-action` to `ghcr.io` with `${{ github.actor }}` /
  `${{ secrets.GITHUB_TOKEN }}` (on the `push`/`workflow_dispatch` trigger the
  actor is the owner, who can write packages); `docker/setup-buildx-action`;
  `docker/build-push-action` with `context: .devcontainer`, push `:latest` +
  `:${{ github.sha }}`, and **GitHub Actions layer cache**
  (`cache-from: type=gha`, `cache-to: type=gha,mode=max`) so Chromium re-bakes are
  cached.
- **Build args:** pass the same pins as `devcontainer.json` (`CLAUDE_CODE_VERSION`,
  `BUN_VERSION`, `PLAYWRIGHT_VERSION`, `GIT_DELTA_VERSION`, `ZSH_IN_DOCKER_VERSION`,
  and `TZ` — `devcontainer.json` passes six args; in CI there's no `localEnv:TZ`
  so the Dockerfile default `Europe/Berlin` applies, which is intended) so the
  published image matches the local one. (Single source of truth for the pins is a
  plan-phase nicety; matching values is the requirement.)
- **Visibility:** the package is created private by default under the user; no
  extra step needed. The repo's `GITHUB_TOKEN` can pull it in the factory jobs
  once the package is linked to the repo (automatic on first push from a repo
  workflow).
- **CI runs amd64** — the publish workflow builds linux/amd64 (the factory runner
  arch). Local arm64 keeps building from the `Dockerfile` directly via
  `@devcontainers/cli`; the two are not required to share a registry image.

### 4.2 Rewrite `factory-go.yml` and `factory-revise.yml`

Move each job _into_ the image and strip everything the image now provides.

**Add** (job-level):

```yaml
container:
  image: ghcr.io/jost-kuenzel/claude-workshop-devcontainer:latest
  credentials:
    username: ${{ github.repository_owner }}
    password: ${{ secrets.GITHUB_TOKEN }}
  options: --cap-add=NET_ADMIN --cap-add=NET_RAW --user 1000
```

- `--user 1000` runs as the non-root `dev` user (uid/gid 1000) — required, as
  locally. (See §6 risk on workspace ownership.)
- **Pull credential = `github.repository_owner`, not `github.actor`.** The factory
  jobs fire on `issues` / `issue_comment`, where `github.actor` is the
  issue/comment author — who, if an outside collaborator, may lack `packages:
read`. The repo owner always can pull the repo-linked private package. (The
  publish workflow in §4.1 stays on `github.actor` because its push trigger's
  actor is the owner.)
- First step inside the job: **`sudo /usr/local/bin/init-firewall.sh`** (the
  baked-in script + its passwordless sudoers rule, identical to the local
  `postStartCommand`). Runs after `actions/checkout` (checkout needs github
  egress, which is open until the firewall is programmed) but before
  `bun install` and the Claude orchestrator.

**Delete** (all now baked into the image):

- `apt-get install -y bubblewrap socat` + the
  `sysctl kernel.apparmor_restrict_unprivileged_userns=0` line.
- `curl -fsSL https://claude.ai/install.sh | bash` + the `$GITHUB_PATH` append.
- `oven-sh/setup-bun@v2` (bun is baked).
- Any browser-install step (Chromium is baked).

**Keep:** the `actions/checkout`, git identity config, `bun install
--frozen-lockfile`, the `bun tools/factory/workflow-*.ts` run, and the
`upload-artifact` logs step. The `env:` block (incl.
`CLAUDE_CODE_OAUTH_TOKEN`, `GH_TOKEN`) is auto-injected into container steps — no
change.

### 4.3 `tools/factory/lib/claude.ts` — `CI_SANDBOX`

```ts
/**
 * Shared CI invocation profile. The egress-firewalled devcontainer image is the
 * boundary now (one image, used locally and in CI); auto mode's server-side
 * classifier reviews each action before it runs. autoMode trusted-infra config
 * lives in tools/factory/ci.settings.json, passed via --settings.
 */
export const CI_SANDBOX = {
  settings: "tools/factory/ci.settings.json",
  permissionMode: "auto",
  model: "opus",
} as const;
```

- `permissionMode: "bypassPermissions"` → `"auto"`; comment rewritten to describe
  the container + classifier boundary.
- Add `model: "opus"` (decision §2.4). `buildClaudeArgs` already forwards `model`.
- The `allowedTools?` doc comment on `ClaudeOptions` (currently "Omitted under
  `CI_SANDBOX`, where … `bypassPermissions` makes the allowlist moot") is updated
  to reflect that per-step tool scoping is still omitted under auto mode (the
  container + classifier are the boundary; the existing call sites pass no
  `allowedTools` and that stays).

### 4.4 `tools/factory/ci.settings.json` — repurpose

Drop the `sandbox` block; add `autoMode`:

```json
{
  "autoMode": {
    "environment": [
      "$defaults",
      "Organization: the ACME CRM workshop project (github.com/jost-kuenzel/claude-workshop). Primary use: an automated software-engineering factory that, per task, edits this repo, commits, pushes a feature branch, and opens a pull request against this same repo. Pushing feature branches and opening/commenting on PRs on this repo is routine and trusted; pushing to or force-pushing main is not.",
      "Trusted upstream data API: thesimpsonsapi.com is the ACME CRM app's external data source. The local dev server (localhost:3000) and the Playwright browser verification fetch application data from it during verification; outbound requests to thesimpsonsapi.com are routine and trusted, not exfiltration."
    ]
  }
}
```

- `allow`, `soft_deny`, `hard_deny` are **omitted** → their built-in `$defaults`
  stay fully in force (per the docs, omitting a section leaves its defaults
  intact). This keeps the built-in protections (force-push, push-to-main,
  `curl | bash`, data-exfil) active while trusting our own repo + data API.
- Reactive loop: when a real run records a denial for a routine pattern, add a
  prose `allow` entry (with `"$defaults"` first) and re-run; validate with
  `claude auto-mode config`.

### 4.5 Operator setup (mostly automated)

Verified against the live repo (`jost-kuenzel/claude-workshop`):

- **Repo default workflow-token permission is `write`**, so the publish workflow's
  explicit `packages: write` lets the built-in `GITHUB_TOKEN` push to GHCR — **no
  manual token/PAT setup**.
- **First image build is triggerable without the UI.** Merging SP2 does _not_ touch
  `.devcontainer/**`, so the path-filtered publish workflow won't auto-fire on
  merge. Bootstrap it with `gh workflow run devcontainer-image.yml` (the
  `workflow_dispatch` trigger exists for exactly this; the operator's `gh` has
  `workflow` scope). Wait for `:latest` to appear before any factory job runs.
- **Pull access auto-links.** Pushing a package with `GITHUB_TOKEN` from this
  repo's Actions automatically connects the package to the repo, so the same-repo
  `factory-go` / `factory-revise` jobs can pull the private image with no manual
  grant.
- **Single human-only fallback, only if needed.** If the auto-link doesn't happen
  and the first factory run fails the image pull (`denied: permission_denied`), the
  owner grants the repo Read once: package → _Package settings_ → _Manage Actions
  access_ → add `claude-workshop` = Read. This needs package-admin (the automation
  token lacks `*:packages` scope), so it can't be scripted — but it's only touched
  if the auto-link fails.
- **Repo is public, image is private (by choice).** Package visibility is
  independent of repo visibility and defaults to private on creation; this is why
  §4.2 supplies pull `credentials`. No action needed to make it private.

### 4.6 Refresh the factory guide

Final step: run the `docs-factory` skill to regenerate
`docs/factory/factory-process-guide.md` for the new container + auto-mode
boundary (image pull, firewall step, no bubblewrap, classifier review).

## 5. Data / control flow (CI, after SP2)

```
issue labeled factory-go
  └─ job starts INSIDE ghcr.io/.../claude-workshop-devcontainer:latest (user dev, NET_ADMIN/NET_RAW)
       1. actions/checkout            (github egress open — firewall not yet up)
       2. sudo init-firewall.sh       (default-DROP + allowlist + fail-closed self-test)
       3. git identity config
       4. bun install --frozen-lockfile   (registry.npmjs.org allowed)
       5. bun tools/factory/workflow-go.ts
            └─ runClaude(... CI_SANDBOX) → claude --permission-mode auto --model opus
                 --settings tools/factory/ci.settings.json
                 → each shell/network action routed to the auto-mode classifier
       6. upload-artifact .factory/logs/
```

`factory-revise` is the same shape (its existing PR-branch resolution step runs
inside the container too).

## 6. Limitations & integration risks (honest)

- **Headless auto-mode abort (main risk).** No human to approve a fallback: after
  **3 consecutive / 20 total** classifier blocks the run aborts. Several
  default-blocked actions (force push, push to `main`, `curl | bash`) overlap with
  things a build might attempt. Mitigation: the §4.4 environment trust + reactive
  `allow` additions + watching the first runs. The PR-merge is done by the human
  with `--admin` (the classifier correctly blocks an agent doing a protection
  bypass), so the factory never needs to merge.
- **Non-root workspace ownership in a GitHub container job.** GitHub mounts the
  workspace and may own paths as root while we run as uid 1000; `actions/checkout`
  / `bun install` writes could hit `EACCES`. **Verify in Phase 2**; if it bites,
  the fix is a small "fix workspace ownership" step (e.g. `sudo chown -R dev
/workspace` before the writing steps) or aligning the runner's work dir
  ownership — decided during implementation against the real failure, not
  pre-emptively.
- **Firewall inside a hosted-runner container.** `init-firewall.sh` needs
  `NET_ADMIN`/`NET_RAW` (granted via `options:`) and programs `iptables`/`ipset`.
  It self-tests and fails closed — if the hosted-runner container networking
  rejects a rule, the job fails loudly rather than running unprotected. Confirm
  the self-test passes on the runner in Phase 2.
- **GHCR pull auth.** The private package must be linked to the repo so the job
  `GITHUB_TOKEN` (with `packages: read`, default for repo workflows) can pull it.
  First push from the publish workflow links it; verify the factory job can pull.
  The pull credential uses `github.repository_owner` (not `github.actor`) so a run
  triggered by a non-owner collaborator's issue/comment still authenticates as the
  owner (§4.2).
- **Classifier cost + latency.** Each shell/network action adds a classifier
  round-trip + tokens on a chatty pipeline (reads / working-dir edits skip it).
  Pinned `opus` is pricier per call than the prior default — watch run cost.
- **Subscription `claude -p` billing change (2026-06-15).** From that date
  `claude -p` on subscription plans draws from a separate monthly Agent SDK
  credit. The factory runs `claude -p`; today is 2026-06-12. Watch capacity once
  SP2 runs land after the 15th.
- **Bootstrap ordering.** The publish workflow must run (image present in GHCR)
  **before** the first factory job that references it. Sequence: merge the publish
  workflow → confirm the image is published → then merge the workflow rewrites (or
  `workflow_dispatch` the publish first). Captured as a plan-phase task ordering.

## 7. Testing & verification

- **Unit:** `tools/factory/lib/__tests__/claude.test.ts:48` asserts
  `permissionMode === "bypassPermissions"` — flip it to `"auto"` and add a
  `model === "opus"` assertion (line 46's `--allowedTools`-omitted assertion stays
  true under auto). `bun run test`, `bun run lint`, `bun run typecheck` all green.
- **Workflow lint:** validate the rewritten YAML (e.g. `actionlint` if available,
  else a careful read) — container/credentials/options syntax is easy to typo.
- **Publish dry-run:** trigger `devcontainer-image.yml` via `workflow_dispatch`;
  confirm `:latest` + `:<sha>` appear in GHCR private and the factory `GITHUB_TOKEN`
  can pull.
- **Phase-2 acceptance (the real test):** a real `factory-go` run completes inside
  the container — checks out, programs the firewall (self-test passes), installs,
  commits, pushes a branch, opens a PR, and `frontend-verify` drives Chromium —
  with **no allowlist drift, no bubblewrap, and no classifier-block abort**. Drive
  it with a small throwaway issue and watch the logs artifact for `permission`
  denials.

## 8. Out of scope

- **SP3** — the `&&`/pipe rule + agent `tools:` allowlist cleanup (parent §6a).
  Separate follow-up; verify first whether auto mode overrides a subagent's
  `tools:` capability list before touching it.
- Migrating the `sbx`/`nektos-act` kit onto this image.
- `managed-settings.json` org policy (`disableAutoMode` / `disableBypassPermissionsMode`).
- MCP servers inside the container (would need allowlist domains).

## 9. Open questions

1. **Workspace-ownership fix** — needed or not under `--user 1000` on the hosted
   runner? Resolve against the real first run (§6), not pre-emptively.
2. **Exact `opus` pin form** — alias `opus` (floats to current Opus, always
   auto-eligible) vs a dated id. Spec picks the alias; revisit only if determinism
   against Opus _minor_ changes is wanted.
3. **Pin single-sourcing** — whether the publish workflow reads the toolchain pins
   from `devcontainer.json` or duplicates them. Cosmetic; decided in the plan.
