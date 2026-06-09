---
name: Local Claude dev container with egress firewall
description: SP1 — a Docker dev container that is the egress-firewalled, fully-tooled local environment Claude runs in on macOS, plus a `bun run sandbox` wrapper. CI parity (SP2) and the agent allowlist cleanup (SP3) are out of scope for this issue.
status: draft
issue: 52
---

# Claude Dev Container Sandbox — Design

- **Date:** 2026-06-09 10:18
- **Status:** Draft (approved decisions locked; not yet implemented)
- **Author:** Jost Künzel (with Claude)
- **Topic:** A Docker dev container that is the single environment Claude runs in —
  egress-firewalled, fully tooled, auto-mode permissions — used locally now and in
  CI later.

> **Build scope for issue #52 = SP1 only** — §4–§5: the local devcontainer, egress
> firewall, and `bun run sandbox` wrapper. **§6 (SP2 — CI parity) and §6a (SP3 —
> agent allowlist / `&&` cleanup) are OUT OF SCOPE for this issue** and must not be
> built here; they are kept as forward design and become a separate follow-up issue
> once SP1 is proven. Host runtime: Docker Desktop.

---

## 1. Problem & motivation

Claude runs in two places with **different, unequal** isolation:

- **CI** (`factory-go` / `factory-revise`): Claude runs with
  `--permission-mode bypassPermissions` and the boundary is an OS sandbox
  (`bubblewrap` + `socat`) plus a network egress allowlist in
  `tools/factory/ci.settings.json`. CI is also a throwaway VM.
- **Local (developer Mac):** Claude runs **completely unrestricted**. `bubblewrap`
  is Linux-only and cannot run on macOS, so there is no sandbox and no egress
  control at all.

So the real security gap is **local**, not CI. We also maintain **two** egress
allowlists (the CI settings file and, implicitly, "nothing" locally) that drift.

**Goal:** one reproducible, egress-firewalled environment — defined once — that
Claude runs inside both locally and in CI, giving the same tools, the same network
boundary, and the same permission model in both places.

### Why a dev container

A [dev container](https://containers.dev/) is an open-spec Docker dev environment
(`devcontainer.json`) usable from VS Code, JetBrains, Codespaces, **and headless
via the `@devcontainers/cli`** — so it is not editor-locked. It is the
standardized form of "one shared image, used locally and in CI," and Anthropic
ships a [reference Claude Code dev container](https://github.com/anthropics/claude-code/tree/main/.devcontainer)
we adapt rather than invent from scratch.

---

## 2. Locked decisions

These were settled during brainstorming and are **not** open questions:

1. **The container IS the sandbox.** No nested OS sandbox. `bubblewrap` / `socat`
   are removed when CI moves onto the container. One boundary, one egress list.
2. **Egress is enforced inside the container** via an `iptables` + `ipset`
   firewall with a **default-DROP** policy and a small allowlist (Anthropic's
   `init-firewall.sh` pattern). This is the security feature the user wants.
3. **Permission model: `auto` mode in both environments.** Claude runs with
   `--permission-mode auto` locally **and** in the factory. A server-side
   classifier reviews each action before it runs — blocking escalation,
   unrecognized infrastructure, and hostile-content-driven actions — without
   permission prompts. This is a deliberate change from today's
   `bypassPermissions`: auto mode adds a safety layer on top of the container +
   egress boundary (notably it blocks "sending sensitive data to external
   endpoints", mitigating the credential-exfiltration limitation in §8).
   **Accepted tradeoff:** headless CI auto mode **aborts on repeated classifier
   blocks** (no human to approve) — see §6 step 4 and §8 for the mitigations.
4. **Sequencing: local first, CI second.** Phase 1 (local) delivers the security
   win standalone. Phase 2 (CI parity) follows once the image is trusted.
5. **A `bun run sandbox` wrapper** brings the container up and drops the user into
   a shell inside it — CLI-only, no editor required.

---

## 3. Goals / Non-goals

**Goals**

- A `.devcontainer/` that builds an image with the full toolchain (bun, Claude
  CLI, Chromium + `playwright-cli`, `git`, `gh`) and an egress firewall.
- `bun run sandbox` → one command to enter the box from the host CLI.

**Non-goals (for issue #52)**

- **SP2 — CI parity** (move the factory workflows onto the image, switch to `auto`,
  delete `bubblewrap`/`socat` + the `ci.settings.json` `sandbox` block). Documented
  in §6 as forward design; a separate follow-up issue once SP1 is proven.
- **SP3 — agent allowlist / `&&` cleanup** (§6a). Separate follow-up.
- Replacing the existing `sbx`/`nektos-act` kit (`sandbox/kits/act/`). Out of scope;
  it serves a different purpose (running workflows locally via `act`).
- Mandating VS Code. The editor integration is a free bonus, not a requirement.
- Hardening against a _malicious_ repository (see §8 limitations). This protects a
  _trusted_ repo's Claude session from accidental damage and unbounded egress.

---

## 4. Architecture

```
.devcontainer/
├── devcontainer.json     # caps, mounts, user, env, postStart → firewall
├── Dockerfile            # base image + toolchain + non-root user
└── init-firewall.sh      # iptables/ipset default-DROP + allowlist + self-test
tools/sandbox/
└── sandbox.ts            # host-side wrapper invoked by `bun run sandbox`
```

### 4.1 Image (`Dockerfile`)

- **Base:** `mcr.microsoft.com/devcontainers/base:ubuntu` (matches Anthropic's
  reference; multi-arch — arm64 on the Mac, amd64 in CI).
- **Non-root user** `node` as `remoteUser` — **required**. Matches
  Anthropic's reference, keeps least-privilege inside the container, and keeps the
  image safe to run with `bypassPermissions` too (which the CLI refuses as root).
  Applies both locally and in CI.
- **Tooling, version-pinned for reproducibility:**
  - `bun@1.2.0` (matches `package.json` `packageManager`).
  - Claude CLI — installed pinned (`npm i -g @anthropic-ai/claude-code@X.Y.Z`,
    **≥ v2.1.83** for auto mode) with `DISABLE_AUTOUPDATER=1`, so the image is
    deterministic.
  - Chromium + its OS deps via `playwright-cli install-browser chromium --with-deps`
    **at build time** → no Playwright CDN egress needed at runtime.
  - `git`, `gh`, plus firewall deps `iptables`, `ipset`, `dnsutils`, `curl`.
- `PLAYWRIGHT_BROWSERS_PATH` set to a fixed, writable in-container path so the
  baked browser + `playwright-cli` daemon dir resolve correctly.

### 4.2 `devcontainer.json`

```jsonc
{
  "build": { "dockerfile": "Dockerfile" },
  "remoteUser": "node",
  "runArgs": ["--cap-add=NET_ADMIN", "--cap-add=NET_RAW"],
  "containerEnv": {
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1", // no sentry/statsig egress
    "DISABLE_AUTOUPDATER": "1",
  },
  "mounts": [
    // Persist Claude auth + settings across rebuilds, isolated per container.
    "source=claude-code-config-${devcontainerId},target=/home/node/.claude,type=volume",
  ],
  "postStartCommand": "sudo /usr/local/bin/init-firewall.sh",
}
```

- `NET_ADMIN` / `NET_RAW` are the **only** elevated capabilities, needed so the
  firewall script can program `iptables`. Nothing runs privileged.
- The workspace is bind-mounted (dev container default) so edits land in the host
  repo; the `~/.claude` **named volume** keeps auth across rebuilds.
- Auto mode is selected via the **`--permission-mode auto` flag** (passed by the
  wrapper locally and by the factory in CI), not via `defaultMode` in settings —
  Claude Code ignores `defaultMode: "auto"` from project/local `.claude/settings`
  on purpose, so a repo cannot grant itself auto mode.

### 4.3 Firewall (`init-firewall.sh`)

Adapted from the Anthropic reference. Behavior:

1. Flush rules; set `INPUT`/`FORWARD`/`OUTPUT` default policy to **`DROP`**.
2. Allow loopback, established/related, DNS (53), and the detected host subnet.
3. Resolve the **allowlist** (below) — for GitHub, pull CIDR ranges from
   `api.github.com/meta` into an `ipset`; for the rest, resolve A records to an
   `ipset`.
4. **Self-verify** on startup and **fail closed**: assert a denied host (e.g.
   `https://example.com`) is blocked AND an allowed host (e.g.
   `https://api.github.com/zen`) succeeds; exit non-zero if either check fails.

### 4.4 Egress allowlist (runtime)

Everything not listed is dropped. Chromium is baked at build time, so no browser
CDN is needed at runtime.

| Destination                                                            | Why                                                                                             |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `api.anthropic.com`                                                    | Claude inference + the auto-mode classifier                                                     |
| `claude.ai`, `console.anthropic.com`                                   | Claude Code OAuth / token sign-in                                                               |
| `github.com` + `api.github.com/meta` CIDRs + `*.githubusercontent.com` | git push/pull, PRs, `gh`, release/raw downloads                                                 |
| `registry.npmjs.org`, `*.npmjs.org`                                    | `bun install` dependency fetches                                                                |
| `thesimpsonsapi.com`                                                   | The ACME CRM app's data source — needed so the running app + `playwright-cli` verification work |
| DNS (53), loopback, host subnet                                        | Infrastructure / `localhost:3000` dev server                                                    |

> **To confirm during implementation:** exact Anthropic auth/inference domains
> against [Network access requirements](https://code.claude.com/docs/en/network-config#network-access-requirements);
> add only what's strictly required. The classifier shares `api.anthropic.com`.

### 4.5 `bun run sandbox` wrapper

- **Where it runs:** on the **host** (outside the container), so it only shells
  out to the dev container CLI. Added to `package.json` `scripts`:
  `"sandbox": "bun tools/sandbox/sandbox.ts"`.
- **Behavior:**
  1. `bunx @devcontainers/cli up --workspace-folder .` (idempotent build+start;
     honors `runArgs`, mounts, `postStartCommand`).
  2. `bunx @devcontainers/cli exec --workspace-folder . zsh` — drops the user into
     an interactive shell **inside** the firewalled container as the non-root user.
- **Default = shell** (the user then types `claude` / `bun run dev` / etc.).
- **Auth forwarding:** if `CLAUDE_CODE_OAUTH_TOKEN` is set in the host shell, pass
  it through with `--remote-env CLAUDE_CODE_OAUTH_TOKEN` so token-based auth works
  with no interactive login; if unset, rely on the volume-persisted `/login`.
- **Flags:**
  - `--claude` → exec `claude --permission-mode auto` directly instead of a shell.
  - `--rebuild` → pass `--remove-existing-container` to `up` for a clean rebuild.
- **Preflight:** detect Docker not running and print a clear hint (Docker
  Desktop / OrbStack / Colima). `@devcontainers/cli` is invoked via `bunx`, so no
  global install is required (optionally pin it as a devDependency for offline use).

CLI loop, for reference:

```bash
bun run sandbox            # up + shell inside the box
bun run sandbox --claude   # up + straight into an auto-mode Claude session
bun run sandbox --rebuild  # clean rebuild, then shell
```

### 4.6 Authentication (Claude subscription, both environments)

Claude authenticates against the **Claude subscription** (Max) in both
environments, using the same `CLAUDE_CODE_OAUTH_TOKEN`. The auth **method does not
change** — the only new requirement is that Claude now runs _inside a container_,
so the token must be **forwarded across the host/runner boundary into the
container**. How that forwarding happens is the only per-environment difference.

- **The token.** `claude setup-token` walks through OAuth and prints a
  **one-year** token (it saves nothing — you copy it). "This token authenticates
  with your Claude subscription and requires a Pro, Max, Team, or Enterprise plan.
  It is scoped to inference only." You set it as `CLAUDE_CODE_OAUTH_TOKEN`.
- **CI (container job): forwarding is automatic.** Keep the existing
  `secrets.CLAUDE_CODE_OAUTH_TOKEN` as job-level `env:`. GitHub runs the job's
  steps **inside** the `container:` and injects job/step `env` into them, so the
  token is already inside the container — no extra wiring. (Just don't also set
  `ANTHROPIC_API_KEY`; it outranks the token in the precedence order below.)
- **Local (devcontainer): forward from host, or log in once.** Two options:
  - **Forward the token (mirrors CI):** export `CLAUDE_CODE_OAUTH_TOKEN` in your
    host shell and let the container read it via `devcontainer.json`'s `remoteEnv`
    (`"CLAUDE_CODE_OAUTH_TOKEN": "${localEnv:CLAUDE_CODE_OAUTH_TOKEN}"`) or the
    wrapper's `--remote-env` pass-through (§4.5). **Never** hard-code it in
    `containerEnv` — that value lives in a committed file.
  - **Interactive login once:** run `claude`, complete browser OAuth (expect the
    container **"paste the code"** fallback — the docs note this is "common in …
    containers"). The credential persists in the named `~/.claude` volume
    (`/home/node/.claude/.credentials.json`, mode `0600`) across rebuilds, so
    there's no token to manage locally.
- **Precedence gotcha.** Claude picks the first present of: cloud creds →
  `ANTHROPIC_AUTH_TOKEN` → `ANTHROPIC_API_KEY` → `apiKeyHelper` →
  `CLAUDE_CODE_OAUTH_TOKEN` → interactive subscription login. A stray
  `ANTHROPIC_API_KEY` would **silently override** the subscription token and bill
  the API instead. (`resolveAuthEnv` in `claude.ts` already drops it when unset.)
- **Rotation.** The token expires after **one year** → calendar a refresh
  (`claude setup-token` → update the repo secret).
- **Auto mode + subscription.** Auto mode is "available by default on the
  Anthropic API," which the subscription token uses, so it is **expected to
  work** — provided the session model is Opus 4.6+ / Sonnet 4.6. On
  **Team/Enterprise** an admin must enable it first (and can lock it via
  `disableAutoMode`); on **Pro/Max** it is on by default. **The factory's token
  is on Max → auto mode is on by default, no admin action needed.** Still verify
  by running `claude --permission-mode auto` with the token before the CI cutover.

---

## 5. Phase 1 — Local devcontainer (SP1 — the build target for issue #52)

Deliverables:

1. `.devcontainer/Dockerfile`, `devcontainer.json`, `init-firewall.sh`.
2. `tools/sandbox/sandbox.ts` + `package.json` `sandbox` script.
3. Short docs section (README or `docs/`) on how to use `bun run sandbox`.
4. **Finalize the Anthropic egress entries** (`api.anthropic.com`, `claude.ai`,
   `console.anthropic.com`) in `init-firewall.sh` against the
   [network-config docs](https://code.claude.com/docs/en/network-config#network-access-requirements) —
   an explicit task, not ambient prose (resolves §4.4 note / §10 Q2).

Phase 1 stands alone: it closes the wide-open-laptop gap even if Phase 2 never
happens.

### Phase 1 verification

- `bun run sandbox` builds, starts, and drops into a shell as a non-root user.
- Inside: `curl -sS https://example.com` **fails** (blocked); `curl -sS
https://api.github.com/zen` **succeeds** (allowed); `curl` to
  `https://thesimpsonsapi.com` **succeeds**.
- Inside: `bun install` works; `bun run dev` serves on `localhost:3000`;
  `playwright-cli` can drive the app and "see" it (Chromium present, app data
  loads from the allowed API).
- Inside: `claude --permission-mode auto` starts and reports auto mode active
  (requires CLI ≥ v2.1.83 and a supported model — Opus 4.6+ / Sonnet 4.6).
- `bun run test`, `bun run lint`, `bun run typecheck` pass for the new
  `tools/sandbox/` code.

---

## 6. Phase 2 — CI parity — SP2 · OUT OF SCOPE for #52 (forward design)

> Do **not** build this for issue #52. Kept as forward design for the SP2 follow-up
> issue, after SP1 (§4–§5) is proven.

1. **Publish the image to GHCR** via a small workflow that rebuilds on
   `.devcontainer/**` changes (buildx layer cache for speed).
2. **Rewrite `factory-go.yml` / `factory-revise.yml`:**
   - Run the job inside the published image: `container:` with
     `options: --cap-add=NET_ADMIN --cap-add=NET_RAW`, **run as the non-root image
     user** (`--user node` or image `USER`) — required, same as locally.
   - **Delete** the now-redundant steps: `apt-get install bubblewrap socat`, the
     `apparmor_restrict_unprivileged_userns` sysctl, the `claude.ai/install.sh`
     install, and the `playwright-cli install-browser` step (all baked into the
     image).
   - Run `init-firewall.sh` as the first step.
3. **Switch the permission mode to `auto`.** In `tools/factory/lib/claude.ts`
   change `CI_SANDBOX.permissionMode` from `bypassPermissions` to `auto` and
   update its comment to describe the container + classifier boundary. Strip the
   `sandbox` block from `tools/factory/ci.settings.json` (the container is the
   boundary now).
4. **Make auto mode survive headless.** Configure trusted infrastructure
   ([auto-mode-config](https://code.claude.com/docs/en/auto-mode-config)) via the
   `autoMode.environment` setting so routine factory actions aren't false-positive
   blocked — at minimum the repo's own remote and `thesimpsonsapi.com` — plus
   narrow allow rules (e.g. `Bash(bun run test)`) for the commands every task
   runs. Pin a supported model (Opus 4.6+ / Sonnet 4.6) and CLI ≥ v2.1.83.
   Monitor for classifier-block aborts (3 consecutive / 20 total) and feed false
   positives back into the trusted-infra config.
5. **Allowlist & `&&` cleanup** — see §6a; the exact tool patterns are decided here.
6. **Refresh the factory guide** via the `docs-factory` skill so
   `docs/factory/factory-process-guide.md` reflects the new boundary.

### Phase 2 verification

- A real `factory-go` run completes inside the container: commits, pushes, opens
  a PR, and `frontend-verify` drives Chromium — all with no allowlist drift, no
  `bubblewrap`, and no classifier-block abort.

## 6a. Agent allowlist & `&&` cleanup — SP3 · OUT OF SCOPE for #52 (forward design)

The factory tells subagents **"one command per Bash call — no `&&`/pipes"**
(`.claude/agents/factory-implementer.md:24`,
`.claude/skills/factory-tdd/SKILL.md:69`). This is a **workaround**, not style:
the implementer's `tools:` frontmatter gates Bash to argument patterns
(`Bash(bun:*)`, `Bash(git add:*)`, …), so a chained `a && b` matches no single
pattern and is rejected as a whole — and headless, that wastes a turn. So
"remove the `&&` rule" and "clean up the allowlists" are **one change**: to allow
chaining you must loosen the implementer's Bash patterns.

The `tools:` lists do two jobs — keep this distinction when cleaning up:

1. **Capability / correctness gating (keep):** the implementer has no
   `git push` / `gh` / network; the reviewers are read-only (`Read, Grep, Glob`).
   These enforce pipeline structure and review integrity, not just security, and
   auto mode does **not** replace them.
2. **Argument-pattern granularity (the friction):** what forces "no `&&`" and
   burns turns.

**Recommended direction (exact patterns decided in Phase 2):** loosen granularity
so chaining works and delete both `&&` instructions, while keeping the capability
boundaries (no push/network for the implementer; read-only reviewers).

**To verify first:** whether auto mode overrides a subagent's `tools:` capability
list. Its docs say auto mode _ignores a subagent's `permissionMode`_ but are
silent on the `tools:` list. If the list still applies (likely), auto mode alone
will **not** fix `&&` — the tool patterns must be edited.

---

## 7. Security model

- **Three layers:** (1) the container filesystem boundary, (2) the default-DROP
  egress firewall (allowlist-only, self-verified at startup, fail-closed), and
  (3) auto mode's classifier, which reviews each action before it runs.
- **Auto mode adds per-action review** without prompts: it blocks escalation,
  unrecognized infrastructure, and — critically — sending sensitive data to
  external endpoints. Read-only actions and working-directory edits skip the
  classifier; writes to protected paths (`.git`, `.claude`, `.devcontainer`, …)
  are routed to it.
- **Non-root** user inside the container, as Anthropic's reference intends.

---

## 8. Limitations & risks (honest)

- **Auto mode aborts headless on repeated blocks.** In CI there is no human to
  approve a classifier fallback: after **3 consecutive or 20 total** blocks the
  factory run **aborts**. Several default-blocked actions (force push, push to
  `main`, `curl | bash`) overlap with things a build might attempt. Mitigations:
  trusted-infra config + narrow allow rules (§6 step 4) and monitoring runs for
  block-driven aborts. **This is the main risk of "auto in both".**
- **Auto mode is a research preview** — it reduces, but does not guarantee,
  safety. It mitigates the credential-exfil case (it blocks "sending sensitive
  data to external endpoints") but does not eliminate it. Still: **trusted repos
  only**; do not mount host secrets (`~/.ssh`, cloud creds); prefer
  short-lived/repo-scoped tokens.
- **Classifier cost + latency.** Each shell/network action sends a transcript
  slice + the pending action to a server-side classifier, adding a round-trip and
  token usage on a chatty pipeline. Reads and working-dir edits skip it.
- **Auto mode requirements.** CLI ≥ v2.1.83 and model Opus 4.6+ / Sonnet 4.6;
  available by default on the Anthropic API (the factory's OAuth path). On
  Team/Enterprise an admin must enable it and can lock it off
  (`permissions.disableAutoMode`). Confirm availability for the factory's token.
- **Subscription `claude -p` billing change (2026-06-15).** Per the auth docs,
  "Starting June 15, 2026, Agent SDK and `claude -p` usage on subscription plans
  will draw from a new monthly Agent SDK credit, separate from your interactive
  usage limits." The factory runs `claude -p`, so from that date its usage draws
  from this separate monthly credit — capacity/billing to watch (only ~6 days out
  as of this spec).
- **Allowlist completeness.** Too tight breaks `bun install` / auth / app data;
  too loose weakens the boundary. The startup self-test plus the explicit table in
  §4.4 guard against silent breakage. Adding a dependency from a new host requires
  an allowlist edit (documented friction, by design).
- **Arch parity.** Local is arm64, CI is amd64; the chosen multi-arch base and
  build-time browser install cover both. (This is also why the `nektos-act` kit's
  arm64-only limitation does not apply here.)

---

## 9. Out of scope / future

- Migrating the `sbx`/`act` kit onto this image.
- `managed-settings.json` org policy (e.g. `disableAutoMode` /
  `disableBypassPermissionsMode`) — could be layered later if this leaves a
  single-developer context.
- MCP servers inside the container (would need their domains added to the allowlist).

---

## 10. Open questions

1. Exact pinned Claude CLI version for the image (latest stable ≥ v2.1.83 at build time).
2. Final Anthropic auth/inference domain set — confirm against the network-config
   docs before locking the allowlist.
3. GHCR image name/visibility and cache strategy for Phase 2.
4. Whether auto mode overrides a subagent's `tools:` capability list (drives §6a).
5. ~~Auto mode availability for the factory's token~~ — **resolved:** the token is
   on a **Max** plan, where auto mode is on by default (no admin enablement, no
   `disableAutoMode` lock). Still smoke-test a real `claude --permission-mode auto`
   run with the token + factory model before the CI cutover.
6. Exact `autoMode.environment` trusted-infra entries + narrow allow rules so the
   factory does not abort on classifier blocks.
