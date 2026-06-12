# The Claude sandbox (`bun run sandbox`)

A Docker dev container that is the single, reproducible, **egress-firewalled**
environment Claude runs in locally on macOS. It is fully tooled (bun, the Claude
CLI, Chromium + `playwright-cli`, `git`, `gh`), runs as a **non-root** user, and
enforces a default-DROP network allowlist inside the container.

This is **SP1** of issue #52 (local only). CI parity and the agent allowlist
cleanup are separate follow-ups. Full design:
[`docs/factory/specs/2026-06-09-1018--issue-52--claude-devcontainer-sandbox--design.md`](./factory/specs/2026-06-09-1018--issue-52--claude-devcontainer-sandbox--design.md).

## Prerequisites

- **Docker Desktop** (or OrbStack / Colima) running.
- That's it — `@devcontainers/cli` is invoked via `bunx`, so no global install.

## Usage

```bash
bun run sandbox            # build + start, then a shell inside the box
bun run sandbox --claude   # build + start, then an auto-mode Claude session
bun run sandbox --rebuild  # clean rebuild (--remove-existing-container), then a shell
```

The default drops you into a `zsh` shell as the non-root `dev` user; from there
you run `claude`, `bun run dev`, `bun run test`, etc. — all inside the firewall.

## Authentication (Claude subscription)

Claude authenticates against your Claude **Max** subscription. Two options:

1. **Forward a token (no interactive login).** Export `CLAUDE_CODE_OAUTH_TOKEN`
   in your host shell (get one with `claude setup-token` — it prints a one-year
   token). The wrapper forwards it into the container automatically via
   `--remote-env`. **Never** hard-code it anywhere committed.
2. **Log in once.** Run `claude` inside the box and complete the browser OAuth
   (expect the "paste the code" fallback common in containers). The credential
   persists in the named `~/.claude` volume across rebuilds.

> Do **not** set `ANTHROPIC_API_KEY` — it outranks the subscription token in
> Claude's auth precedence and would bill the API instead.

## What the firewall allows

Everything not on this list is dropped (`.devcontainer/init-firewall.sh`):

| Destination                                                    | Why                                          |
| -------------------------------------------------------------- | -------------------------------------------- |
| `api.anthropic.com`                                            | Claude inference + the auto-mode classifier  |
| `claude.ai`, `platform.claude.com`                             | Claude Code OAuth / token sign-in            |
| GitHub `api.github.com/meta` CIDRs + `*.githubusercontent.com` | git, `gh`, PRs, raw/release downloads        |
| `registry.npmjs.org`                                           | `bun install`                                |
| `thesimpsonsapi.com`                                           | the ACME CRM app's data source               |
| DNS (53), loopback, host subnet                                | infrastructure / `localhost:3000` dev server |

The firewall **self-verifies and fails closed** on every start: it asserts that
a denied host (`example.com`) is blocked and an allowed host
(`api.github.com/zen`) is reachable, exiting non-zero otherwise.

## Verifying it works

Inside the box:

```bash
curl -sS https://example.com           # FAILS (blocked)
curl -sS https://api.github.com/zen    # succeeds (allowed)
curl -sS https://thesimpsonsapi.com    # succeeds (allowed)
bun install                            # works
bun run dev                            # serves on localhost:3000
claude --permission-mode auto          # starts in auto mode (CLI >= 2.1.83)
```

## Notes / limitations

- Adding a dependency from a **new host** requires an allowlist edit in
  `init-firewall.sh` (documented friction, by design).
- This protects a **trusted** repo's Claude session from accidental damage and
  unbounded egress; it is not a defense against a deliberately malicious repo.
- `--cap-add=NET_ADMIN`/`NET_RAW` are the only elevated capabilities, used solely
  so the firewall can program `iptables`. Nothing runs privileged.
