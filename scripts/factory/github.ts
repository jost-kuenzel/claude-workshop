export type ReactionContent = "+1" | "hooray" | "confused";

export function reactIssueArgs(issue: number, content: ReactionContent | string): string[] {
  return [
    "api",
    "--method",
    "POST",
    `repos/{owner}/{repo}/issues/${issue}/reactions`,
    "-f",
    `content=${content}`,
  ];
}

export function reactCommentArgs(commentId: number, content: ReactionContent | string): string[] {
  return [
    "api",
    "--method",
    "POST",
    `repos/{owner}/{repo}/issues/comments/${commentId}/reactions`,
    "-f",
    `content=${content}`,
  ];
}

export function createPrArgs(opts: {
  base: string;
  head: string;
  title: string;
  body: string;
}): string[] {
  return [
    "pr",
    "create",
    "--base",
    opts.base,
    "--head",
    opts.head,
    "--title",
    opts.title,
    "--body",
    opts.body,
  ];
}

export function issueCommentArgs(number: number, body: string): string[] {
  return ["issue", "comment", String(number), "--body", body];
}

/**
 * Low-level process runner. When dryRun is true, logs the command and resolves "" without
 * executing. Otherwise spawns `cmd <args>` and returns stdout (trimmed).
 * Error message format: `<cmd> <args> failed (exit <code>): <stderr>`
 */
export async function runProcess(
  cmd: string,
  args: string[],
  opts: { dryRun?: boolean } = {}
): Promise<string> {
  if (opts.dryRun) {
    console.log(`[dry-run] ${cmd} ${args.join(" ")}`);
    return "";
  }
  const proc = Bun.spawn([cmd, ...args], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed (exit ${code}): ${stderr.trim()}`);
  }
  return stdout.trim();
}

/**
 * Thin exec wrapper around runProcess for `gh`. When dryRun is true, logs the command
 * and resolves "" without touching the network. Otherwise spawns `gh <args>` and returns
 * stdout (trimmed).
 */
export function runGh(args: string[], opts: { dryRun?: boolean } = {}): Promise<string> {
  return runProcess("gh", args, opts);
}
