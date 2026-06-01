import { mkdir } from "node:fs/promises";

export interface ClaudeOptions {
  prompt: string;
  /** Tool allowlist for the top-level orchestrator (per-step scoping). */
  allowedTools: string[];
  model?: string;
  maxTurns?: number;
  permissionMode?: string;
  /** Used only by runClaude for the log filename. */
  runId?: string;
  step?: string;
}

/** Pure: build the argv passed to the `claude` binary (binary name excluded). */
export function buildClaudeArgs(o: ClaudeOptions): string[] {
  const args = ["--print", "--output-format", "stream-json", "--verbose"];
  args.push("--allowedTools", o.allowedTools.join(","));
  if (o.model) args.push("--model", o.model);
  if (o.maxTurns !== undefined) args.push("--max-turns", String(o.maxTurns));
  if (o.permissionMode) args.push("--permission-mode", o.permissionMode);
  args.push(o.prompt); // positional prompt, last
  return args;
}

/** Pure: forward ANTHROPIC_API_KEY only if set; otherwise rely on subscription session. */
export function resolveAuthEnv(env: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (v !== undefined) out[k] = v;
  }
  if (env.ANTHROPIC_API_KEY === undefined) delete out.ANTHROPIC_API_KEY;
  return out;
}

/** Pure: deterministic log path for a run/step. */
export function logPath(runId: string, step: string): string {
  return `.factory/logs/${runId}--${step}.jsonl`;
}

/** Pure: pull the final assistant text out of stream-json lines. */
export function extractResult(jsonlLines: string[]): string {
  for (let i = jsonlLines.length - 1; i >= 0; i--) {
    const line = jsonlLines[i].trim();
    if (!line) continue;
    try {
      const ev = JSON.parse(line);
      if (ev.type === "result" && typeof ev.result === "string") return ev.result;
    } catch {
      // ignore non-JSON lines
    }
  }
  return "";
}

/**
 * Thin I/O shell: spawn `claude`, tee stream-json to stdout and to the log file,
 * return the final assistant text. Verified via dry-run end-to-end runs, not unit tests.
 */
export async function runClaude(o: ClaudeOptions): Promise<string> {
  const runId = o.runId ?? "local";
  const step = o.step ?? "step";
  await mkdir(".factory/logs", { recursive: true });
  const file = logPath(runId, step);
  const env = resolveAuthEnv(process.env as Record<string, string | undefined>);
  const proc = Bun.spawn(["claude", ...buildClaudeArgs(o)], {
    env,
    stdout: "pipe",
    stderr: "inherit",
  });

  const sink = Bun.file(file).writer();
  const lines: string[] = [];
  const decoder = new TextDecoder();
  let buffered = "";
  for await (const chunk of proc.stdout as unknown as AsyncIterable<Uint8Array>) {
    const text = decoder.decode(chunk);
    sink.write(text);
    process.stdout.write(text);
    buffered += text;
    const parts = buffered.split("\n");
    buffered = parts.pop() ?? "";
    for (const l of parts) lines.push(l);
  }
  if (buffered) lines.push(buffered);
  sink.end();

  const code = await proc.exited;
  if (code !== 0) throw new Error(`claude exited ${code} (step ${step}); see ${file}`);
  return extractResult(lines);
}
