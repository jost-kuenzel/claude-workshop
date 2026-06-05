#!/usr/bin/env bun

export interface LintFixPlan {
  /** Whether this file is eligible for auto-fix. */
  shouldFix: boolean;
  /** Commands to run in order (argv arrays). Empty when shouldFix is false. */
  commands: string[][];
}

// Mirror of the original shell case: .ts .tsx .js .mjs .json .md
const FIXABLE = /\.(ts|tsx|js|mjs|json|md)$/;

/** Pure: decide whether a file gets auto-fixed and with which commands. */
export function planLintFix(filePath: string): LintFixPlan {
  if (!filePath || !FIXABLE.test(filePath)) return { shouldFix: false, commands: [] };
  return {
    shouldFix: true,
    commands: [
      ["bunx", "eslint", "--fix", filePath],
      ["bunx", "prettier", "--write", filePath],
    ],
  };
}

// I/O shell — runs only when invoked directly, not when imported by tests.
if (import.meta.main) {
  const event = JSON.parse(await Bun.stdin.text());
  const filePath: string = event.tool_input?.file_path ?? "";

  for (const cmd of planLintFix(filePath).commands) {
    // Best-effort: lint/format failures must never block the edit (parity with the
    // old script's `2>/dev/null` + `exit 0`). Sequential so eslint --fix and
    // prettier --write don't race on the same file.
    const proc = Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore" });
    await proc.exited;
  }
  process.exit(0);
}
