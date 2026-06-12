---
issue: 54
spec: docs/factory/specs/2026-06-12-1235--issue-54--factory-ci-devcontainer-auto-mode--design.md
---

# Factory CI on the Devcontainer Image + Auto-Mode Cutover — Implementation Plan

**Goal:** Make the factory's GitHub Actions (`factory-go` / `factory-revise`) run
inside the SP1 egress-firewalled devcontainer image — published to a private GHCR
image — and switch the CI permission model from `bypassPermissions` to `auto`.

**Architecture:** A new publish workflow builds `.devcontainer/` and pushes
`ghcr.io/jost-kuenzel/claude-workshop-devcontainer:latest` (+ `:<sha>`). The two
factory workflows are rewritten to run their job _inside_ that image
(`container:` with `--cap-add=NET_ADMIN/NET_RAW --user 1000`), running
`init-firewall.sh` as the first step and deleting the now-redundant
bubblewrap/socat install, the AppArmor sysctl, the `curl | bash` CLI install, and
`setup-bun`. The shared CI invocation profile `CI_SANDBOX` (in
`tools/factory/lib/claude.ts`) flips to `permissionMode: "auto"` + `model:
"opus"`, and `tools/factory/ci.settings.json` is repurposed from an OS-sandbox
config into an `autoMode` trusted-infrastructure config (the file the factory
already passes via `--settings`, which is the only place the auto-mode classifier
reads `autoMode` from).

**Tech Stack:** GitHub Actions (`container:` jobs, `docker/build-push-action`,
buildx GHA cache, GHCR), Bun + TypeScript (`tools/factory/lib/claude.ts`,
`bun test`), Claude Code auto mode (`autoMode.environment` settings, docs:
https://code.claude.com/docs/en/auto-mode-config), iptables/ipset firewall baked
into the image.

**Deployment / bootstrap note (operator, not a code task):** the publish workflow
must run and produce `:latest` in GHCR **before** any factory job pulls it.
Merging this work does not touch `.devcontainer/**`, so the path-filtered publish
won't auto-fire — bootstrap it once with `gh workflow run devcontainer-image.yml`
(then confirm `:latest` exists) before labeling an issue `factory-go`. This is an
operator step captured in spec §4.5/§6, not part of any task below.

**Cross-cutting note for every task:** five call sites spread `...CI_SANDBOX`
(`tools/factory/task-run.ts`, `pr-finalize.ts`, `workflow-go.ts`, `plan-gen.ts`,
`workflow-revise.ts`). They inherit the new `permissionMode`/`model`
automatically — **do not edit them**; changing `CI_SANDBOX` in Task 1 is enough.

## Task Checklist

- [x] Task 1: Flip `CI_SANDBOX` to auto mode + pin model opus (TDD)
- [ ] Task 2: Repurpose `ci.settings.json` into an autoMode trusted-infra config
- [ ] Task 3: Add the GHCR devcontainer-image publish workflow
- [ ] Task 4: Rewrite `factory-go.yml` to run inside the image
- [ ] Task 5: Rewrite `factory-revise.yml` to run inside the image
- [ ] Task 6: Refresh the factory process guide (docs-factory skill)

---

### Task 1: Flip `CI_SANDBOX` to auto mode + pin model opus (TDD)

**Files:**

- Modify: `tools/factory/lib/claude.ts` (the `CI_SANDBOX` const + its doc comment;
  and the `allowedTools?` doc comment on `ClaudeOptions`)
- Test: `tools/factory/lib/__tests__/claude.test.ts` (the existing sandbox-profile
  test, currently at lines 44–49)

Context: `CI_SANDBOX` is a shared object spread into every factory `runClaude`
call. `buildClaudeArgs` already forwards a `model` field (`if (o.model)
args.push("--model", o.model)`), so adding `model: "opus"` needs no new arg
plumbing. The only test that asserts the old behavior is the "under the sandbox
profile" test.

- [ ] Step 1: In `tools/factory/lib/__tests__/claude.test.ts`, replace the test
      block currently reading:

  ```ts
  test("emits --settings and omits --allowedTools under the sandbox profile", () => {
    const args = buildClaudeArgs({ prompt: "p", ...CI_SANDBOX });
    expect(args).not.toContain("--allowedTools"); // sandbox is the boundary, not a list
    expect(args[args.indexOf("--settings") + 1]).toBe("tools/factory/ci.settings.json");
    expect(args[args.indexOf("--permission-mode") + 1]).toBe("bypassPermissions");
  });
  ```

  with:

  ```ts
  test("emits --settings, auto mode, and a pinned model; omits --allowedTools under the sandbox profile", () => {
    const args = buildClaudeArgs({ prompt: "p", ...CI_SANDBOX });
    expect(args).not.toContain("--allowedTools"); // container + classifier is the boundary, not a list
    expect(args[args.indexOf("--settings") + 1]).toBe("tools/factory/ci.settings.json");
    expect(args[args.indexOf("--permission-mode") + 1]).toBe("auto");
    expect(args[args.indexOf("--model") + 1]).toBe("opus");
  });
  ```

- [ ] Step 2: Run `bun test tools/factory/lib/__tests__/claude.test.ts` — expect
      FAIL (current `CI_SANDBOX` still says `bypassPermissions` and has no `model`).

- [ ] Step 3: In `tools/factory/lib/claude.ts`, replace the `CI_SANDBOX` block
      (currently lines 22–31) — both the doc comment and the object:

  ```ts
  /**
   * Shared CI invocation profile. The egress-firewalled devcontainer image is the
   * boundary now (one image, used locally and in CI), so steps need no per-tool
   * allow/deny lists. Auto mode's server-side classifier reviews each action
   * before it runs; its trusted-infrastructure config lives in
   * tools/factory/ci.settings.json, passed via --settings. `model: "opus"` pins an
   * auto-mode-eligible model (auto mode requires Opus 4.6+ / Sonnet 4.6).
   */
  export const CI_SANDBOX = {
    settings: "tools/factory/ci.settings.json",
    permissionMode: "auto",
    model: "opus",
  } as const;
  ```

- [ ] Step 4: Update the `allowedTools?` doc comment on the `ClaudeOptions`
      interface (currently lines 5–9) so it no longer claims `bypassPermissions` makes
      the allowlist moot. Replace:

  ```ts
  /**
   * Tool allowlist (per-step scoping). Omitted under {@link CI_SANDBOX}, where the
   * OS sandbox is the boundary and `bypassPermissions` makes the allowlist moot.
   */
  allowedTools?: string[];
  ```

  with:

  ```ts
  /**
   * Tool allowlist (per-step scoping). Omitted under {@link CI_SANDBOX}, where the
   * egress-firewalled container + auto-mode classifier are the boundary, so no
   * per-step tool list is needed.
   */
  allowedTools?: string[];
  ```

- [ ] Step 5: Run `bun test tools/factory/lib/__tests__/claude.test.ts` — expect
      PASS.

- [ ] Step 6: Run `bun run lint` and `bun run typecheck` — expect both clean.

- [ ] Step 7: Commit: `git add tools/factory/lib/claude.ts
tools/factory/lib/__tests__/claude.test.ts && git commit -m "factory: CI_SANDBOX
→ auto mode + pinned opus model"`

---

### Task 2: Repurpose `ci.settings.json` into an autoMode trusted-infra config

**Files:**

- Modify: `tools/factory/ci.settings.json` (full-file replacement)

Context: This file is passed to `claude` via `--settings` (it is
`CI_SANDBOX.settings`). The auto-mode classifier reads `autoMode` from the
`--settings` file (it deliberately ignores `autoMode` in a repo's shared
`.claude/settings.json`). Today the file holds only an OS-sandbox `network`
block, which is dead once the container is the boundary. Replace it with an
`autoMode.environment` list. Omitting `allow`/`soft_deny`/`hard_deny` leaves their
built-in `$defaults` (force-push, push-to-main, `curl | bash`, data-exfil blocks)
fully in force — that is the intended "minimal + reactive" posture.

- [ ] Step 1: Replace the **entire** contents of `tools/factory/ci.settings.json`
      with:

  ```json
  {
    "autoMode": {
      "environment": [
        "$defaults",
        "Organization: the ACME CRM workshop project (github.com/jost-kuenzel/claude-workshop). Primary use: an automated software-engineering factory that, per task, edits this repo, commits, pushes a feature branch, and opens a pull request against this same repo. Pushing feature branches and opening or commenting on PRs on this repo is routine and trusted; pushing to or force-pushing main is not.",
        "Trusted upstream data API: thesimpsonsapi.com is the ACME CRM app's external data source. The local dev server (localhost:3000) and the Playwright browser verification fetch application data from it during verification; outbound requests to thesimpsonsapi.com are routine and trusted, not exfiltration."
      ]
    }
  }
  ```

- [ ] Step 2: Validate it is well-formed JSON: run
      `bun -e "JSON.parse(await Bun.file('tools/factory/ci.settings.json').text())"`
      — expect no error / clean exit.

- [ ] Step 3: Commit: `git add tools/factory/ci.settings.json && git commit -m
"factory: repurpose ci.settings.json into autoMode trusted-infra config"`

---

### Task 3: Add the GHCR devcontainer-image publish workflow

**Files:**

- Create: `.github/workflows/devcontainer-image.yml`

Context: This workflow builds the existing `.devcontainer/Dockerfile` and pushes
it to a private GHCR package so the factory jobs can pull it. It triggers on
pushes to `main` that touch `.devcontainer/**` (so the image rebuilds when the
devcontainer changes) plus `workflow_dispatch` (so it can be bootstrapped
manually). It builds linux/amd64 (the factory runner arch) and passes the same
build args as `.devcontainer/devcontainer.json` so the published image matches the
locally-built one. The package is created private by default; pushing from this
repo's Actions auto-links the package to the repo for pulls.

- [ ] Step 1: Create `.github/workflows/devcontainer-image.yml` with exactly:

  ```yaml
  name: devcontainer-image
  on:
    push:
      branches: [main]
      paths: [".devcontainer/**"]
    workflow_dispatch:

  concurrency:
    group: devcontainer-image
    cancel-in-progress: false

  jobs:
    build:
      runs-on: ubuntu-latest
      permissions:
        contents: read
        packages: write
      steps:
        - uses: actions/checkout@v4
        - uses: docker/setup-buildx-action@v3
        - uses: docker/login-action@v3
          with:
            registry: ghcr.io
            username: ${{ github.actor }}
            password: ${{ secrets.GITHUB_TOKEN }}
        - uses: docker/build-push-action@v6
          with:
            context: .devcontainer
            push: true
            tags: |
              ghcr.io/jost-kuenzel/claude-workshop-devcontainer:latest
              ghcr.io/jost-kuenzel/claude-workshop-devcontainer:${{ github.sha }}
            build-args: |
              TZ=Europe/Berlin
              CLAUDE_CODE_VERSION=2.1.175
              BUN_VERSION=1.2.0
              PLAYWRIGHT_VERSION=1.60.0
              GIT_DELTA_VERSION=0.18.2
              ZSH_IN_DOCKER_VERSION=1.2.0
            cache-from: type=gha
            cache-to: type=gha,mode=max
  ```

  Note: `context: .devcontainer` makes the default Dockerfile path
  `.devcontainer/Dockerfile` and lets its `COPY init-firewall.sh` resolve. The six
  `build-args` values must match `.devcontainer/devcontainer.json`'s `build.args`
  (and the `TZ` default in the Dockerfile) — if those pins have since changed,
  copy the current values from `devcontainer.json` instead of the literals above.

- [ ] Step 2: Validate YAML parses: run
      `bun -e "const y=await Bun.file('.github/workflows/devcontainer-image.yml').text(); if(!y.includes('build-push-action')) throw new Error('content check failed'); console.log('ok')"`
      (a lightweight content sanity check; full schema validation happens when the
      workflow runs).

- [ ] Step 3: Commit: `git add .github/workflows/devcontainer-image.yml && git
commit -m "factory: add GHCR devcontainer-image publish workflow"`

---

### Task 4: Rewrite `factory-go.yml` to run inside the image

**Files:**

- Modify: `.github/workflows/factory-go.yml` (full-file replacement)

Context: Today this job runs on a bare `ubuntu-latest` runner and installs the
toolchain + an OS sandbox at runtime. Move the whole job _into_ the published
image and delete everything the image now provides. Keep the trigger, the `if:`
author-association gate, the `env:` block, the checkout, git identity, `bun
install`, the orchestrator run, and the logs upload. Add `packages: read` so the
job token can pull the private image, and run the baked-in firewall as the first
step (after checkout — checkout needs GitHub egress, which is open until the
firewall is programmed). Run as `--user 1000` (the non-root `dev` user).

Known risk (do not pre-empt): under `--user 1000`, GitHub's workspace may be
root-owned, so `actions/checkout` / `bun install` could hit `EACCES`. Implement
the clean version below as written; only if a real run fails that way, add a
workspace-chown step — see spec §6. Don't add it speculatively.

- [ ] Step 1: Replace the **entire** contents of `.github/workflows/factory-go.yml`
      with:

  ```yaml
  name: factory-go
  on:
    issues:
      types: [labeled]

  concurrency:
    group: factory-go-issue-${{ github.event.issue.number }}
    cancel-in-progress: false

  jobs:
    build:
      if: |
        github.event.label.name == 'factory-go' &&
        contains(fromJSON('["OWNER", "MEMBER", "COLLABORATOR"]'), github.event.issue.author_association)
      runs-on: ubuntu-latest
      timeout-minutes: 60
      container:
        image: ghcr.io/jost-kuenzel/claude-workshop-devcontainer:latest
        credentials:
          username: ${{ github.repository_owner }}
          password: ${{ secrets.GITHUB_TOKEN }}
        options: --cap-add=NET_ADMIN --cap-add=NET_RAW --user 1000
      permissions:
        contents: write
        issues: write
        pull-requests: write
        packages: read
      env:
        CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
        GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        ISSUE_NUMBER: ${{ github.event.issue.number }}
      steps:
        - uses: actions/checkout@v4
          with: { fetch-depth: 0 }
        - run: sudo /usr/local/bin/init-firewall.sh
        - run: |
            git config user.name "github-actions[bot]"
            git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
        - run: bun install --frozen-lockfile
        - run: bun tools/factory/workflow-go.ts
        - if: always()
          uses: actions/upload-artifact@v4
          with:
            name: factory-logs-${{ github.run_id }}
            path: .factory/logs/
  ```

  Deletions vs. the old file (confirm none remain): `oven-sh/setup-bun@v2`; the
  `apt-get install -y bubblewrap socat` + `sysctl
kernel.apparmor_restrict_unprivileged_userns=0` step; the `curl -fsSL
https://claude.ai/install.sh | bash` + `$GITHUB_PATH` step.

- [ ] Step 2: Validate YAML content sanity: run
      `bun -e "const y=await Bun.file('.github/workflows/factory-go.yml').text(); for(const bad of ['bubblewrap','install.sh','setup-bun']) if(y.includes(bad)) throw new Error('leftover: '+bad); if(!y.includes('init-firewall.sh')||!y.includes('container:')) throw new Error('missing required content'); console.log('ok')"`
      — expect `ok`.

- [ ] Step 3: Commit: `git add .github/workflows/factory-go.yml && git commit -m
"factory: run factory-go inside the devcontainer image (auto mode)"`

---

### Task 5: Rewrite `factory-revise.yml` to run inside the image

**Files:**

- Modify: `.github/workflows/factory-revise.yml` (full-file replacement)

Context: Same transformation as `factory-go.yml`, but `factory-revise` keeps its
extra first step — resolving the PR head branch via `gh pr view` and checking that
branch out by name (an `issue_comment` event doesn't expose the PR head branch).
That `prbranch` step runs before the firewall (it needs GitHub egress, which is
open until the firewall is programmed). Keep the trigger, the `if:` gate, the
`env:` block (`PR_NUMBER`, `COMMENT_ID`), and the logs upload. Same `--user 1000`
workspace-ownership caveat as Task 4 applies: implement the clean version; only add
a workspace-chown step if a real run hits `EACCES` (spec §6).

- [ ] Step 1: Replace the **entire** contents of
      `.github/workflows/factory-revise.yml` with:

  ```yaml
  name: factory-revise
  on:
    issue_comment:
      types: [created]

  concurrency:
    group: factory-revise-pr-${{ github.event.issue.number }}
    cancel-in-progress: true

  jobs:
    revise:
      if: |
        github.event.issue.pull_request != null &&
        contains(github.event.comment.body, '/factory-revise') &&
        contains(fromJSON('["OWNER", "MEMBER", "COLLABORATOR"]'), github.event.comment.author_association)
      runs-on: ubuntu-latest
      timeout-minutes: 30
      container:
        image: ghcr.io/jost-kuenzel/claude-workshop-devcontainer:latest
        credentials:
          username: ${{ github.repository_owner }}
          password: ${{ secrets.GITHUB_TOKEN }}
        options: --cap-add=NET_ADMIN --cap-add=NET_RAW --user 1000
      permissions:
        contents: write
        issues: write
        pull-requests: write
        packages: read
      env:
        CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
        GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        PR_NUMBER: ${{ github.event.issue.number }}
        COMMENT_ID: ${{ github.event.comment.id }}
      steps:
        - id: prbranch
          run: echo "name=$(gh pr view "$PR_NUMBER" -R "$GITHUB_REPOSITORY" --json headRefName -q .headRefName)" >> "$GITHUB_OUTPUT"
        - uses: actions/checkout@v4
          with:
            ref: ${{ steps.prbranch.outputs.name }}
        - run: sudo /usr/local/bin/init-firewall.sh
        - run: |
            git config user.name "github-actions[bot]"
            git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
        - run: bun install --frozen-lockfile
        - run: bun tools/factory/workflow-revise.ts
        - if: always()
          uses: actions/upload-artifact@v4
          with:
            name: factory-logs-${{ github.run_id }}
            path: .factory/logs/
  ```

  Deletions vs. the old file (confirm none remain): `oven-sh/setup-bun@v2`; the
  `apt-get install -y bubblewrap socat` + `sysctl` step; the `curl … install.sh |
bash` + `$GITHUB_PATH` step.

- [ ] Step 2: Validate YAML content sanity: run
      `bun -e "const y=await Bun.file('.github/workflows/factory-revise.yml').text(); for(const bad of ['bubblewrap','install.sh','setup-bun']) if(y.includes(bad)) throw new Error('leftover: '+bad); for(const need of ['init-firewall.sh','container:','prbranch']) if(!y.includes(need)) throw new Error('missing: '+need); console.log('ok')"`
      — expect `ok`.

- [ ] Step 3: Commit: `git add .github/workflows/factory-revise.yml && git commit
-m "factory: run factory-revise inside the devcontainer image (auto mode)"`

---

### Task 6: Refresh the factory process guide (docs-factory skill)

**Files:**

- Modify: `docs/factory/factory-process-guide.md`

Context: The factory's boundary changed (container image + egress firewall +
auto-mode classifier instead of bubblewrap/socat + `bypassPermissions`), so the
process guide must be regenerated. This guide is owned by the `docs-factory`
skill, which re-explores the live factory and rewrites the whole document — it is
**not** a hand-edit and **not** a code-writing-subagent task. The orchestrator (or
a human) runs the `docs-factory` skill after Tasks 1–5 land.

- [ ] Step 1: Invoke the `docs-factory` skill to regenerate
      `docs/factory/factory-process-guide.md`. Confirm the regenerated guide reflects:
      the published GHCR image, the `container:` jobs running as the non-root `dev`
      user, `init-firewall.sh` as the first step, the removal of bubblewrap/socat and
      the `curl | bash` install, and the `auto` permission mode with the
      `ci.settings.json` `autoMode` trusted-infra config.

- [ ] Step 2: Verify the whole repo is green: `bun run test`, `bun run lint`, `bun
run typecheck` — expect all clean. (Final regression gate after all tasks.)

- [ ] Step 3: Commit (done by the skill, or manually if needed): `git add
docs/factory/factory-process-guide.md && git commit -m "factory: refresh process
guide for the container + auto-mode boundary"`
