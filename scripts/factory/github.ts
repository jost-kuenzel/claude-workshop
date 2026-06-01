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
 * Thin exec wrapper. When dryRun is true, logs the command and resolves "" without
 * touching the network. Otherwise spawns `gh <args>` and returns stdout (trimmed).
 */
export async function runGh(args: string[], opts: { dryRun?: boolean } = {}): Promise<string> {
  if (opts.dryRun) {
    console.log(`[dry-run] gh ${args.join(" ")}`);
    return "";
  }
  const proc = Bun.spawn(["gh", ...args], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) {
    throw new Error(`gh ${args.join(" ")} failed (exit ${code}): ${stderr.trim()}`);
  }
  return stdout.trim();
}
