#!/usr/bin/env bun
/**
 * `bun run sandbox` — host-side wrapper that brings the Claude dev container up
 * and drops you into a shell (or straight into an auto-mode Claude session)
 * inside the egress-firewalled box.
 *
 * Runs on the HOST (outside the container); it only shells out to the dev
 * container CLI (`@devcontainers/cli`, invoked via `bunx`, so no global install
 * is required). See docs/sandbox.md and the design at
 * docs/factory/specs/2026-06-09-1018--issue-52--claude-devcontainer-sandbox--design.md.
 *
 *   bun run sandbox            # up + shell inside the box
 *   bun run sandbox --claude   # up + straight into an auto-mode Claude session
 *   bun run sandbox --rebuild  # clean rebuild, then shell
 */

const DEVCONTAINER_CLI = "@devcontainers/cli";

export interface SandboxFlags {
  /** `--claude`: exec `claude --permission-mode auto` instead of a shell. */
  claude: boolean;
  /** `--rebuild`: pass `--remove-existing-container` to `up` for a clean rebuild. */
  rebuild: boolean;
}

/** Pure: parse the wrapper's CLI flags. Unknown flags are ignored. */
export function parseFlags(argv: string[]): SandboxFlags {
  return {
    claude: argv.includes("--claude"),
    rebuild: argv.includes("--rebuild"),
  };
}

/** Pure: argv for `bunx @devcontainers/cli up` (idempotent build+start). */
export function buildUpArgs(o: { workspace: string; rebuild: boolean }): string[] {
  const args = [DEVCONTAINER_CLI, "up", "--workspace-folder", o.workspace];
  if (o.rebuild) args.push("--remove-existing-container");
  return args;
}

/**
 * Pure: argv for `bunx @devcontainers/cli exec`. `command` is the in-container
 * argv to run (a shell, or claude). `remoteEnv` entries are injected into the
 * exec'd process as `--remote-env KEY=VALUE`.
 */
export function buildExecArgs(o: {
  workspace: string;
  command: string[];
  remoteEnv?: Record<string, string>;
}): string[] {
  const args = [DEVCONTAINER_CLI, "exec", "--workspace-folder", o.workspace];
  for (const [k, v] of Object.entries(o.remoteEnv ?? {})) {
    args.push("--remote-env", `${k}=${v}`);
  }
  args.push(...o.command);
  return args;
}

/** Pure: the in-container command for the selected mode. */
export function containerCommand(flags: SandboxFlags): string[] {
  return flags.claude ? ["claude", "--permission-mode", "auto"] : ["zsh"];
}

/**
 * Host env vars forwarded into the container session via `--remote-env`:
 * - CLAUDE_CODE_OAUTH_TOKEN: subscription auth (unset → volume-persisted `/login`).
 * - TERM / COLORTERM: match the host terminal's color capability inside the box.
 *   `devcontainer exec` does not pass these through, so without forwarding the
 *   session falls back to a low-color TERM (washed-out, few shades).
 */
export const FORWARDED_ENV_VARS = ["CLAUDE_CODE_OAUTH_TOKEN", "TERM", "COLORTERM"] as const;

/** Pure: forward each {@link FORWARDED_ENV_VARS} entry only when it is set. */
export function forwardedRemoteEnv(
  env: Record<string, string | undefined>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of FORWARDED_ENV_VARS) {
    const value = env[key];
    if (value) out[key] = value;
  }
  return out;
}

/** Preflight: is a Docker daemon reachable? */
async function dockerRunning(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["docker", "info"], { stdout: "ignore", stderr: "ignore" });
    return (await proc.exited) === 0;
  } catch {
    return false;
  }
}

/** Run `bunx <args>` with the user's terminal attached; resolve with exit code. */
async function runBunx(args: string[]): Promise<number> {
  const proc = Bun.spawn(["bunx", ...args], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  return proc.exited;
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));

  if (!(await dockerRunning())) {
    console.error(
      "Docker does not appear to be running.\n" +
        "Start Docker Desktop (or OrbStack / Colima) and try again."
    );
    process.exit(1);
  }

  const workspace = ".";

  const upCode = await runBunx(buildUpArgs({ workspace, rebuild: flags.rebuild }));
  if (upCode !== 0) process.exit(upCode);

  const execCode = await runBunx(
    buildExecArgs({
      workspace,
      command: containerCommand(flags),
      remoteEnv: forwardedRemoteEnv(process.env as Record<string, string | undefined>),
    })
  );
  process.exit(execCode);
}

if (import.meta.main) {
  await main();
}
