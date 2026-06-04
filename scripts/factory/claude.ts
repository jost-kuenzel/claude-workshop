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
  /** Human-readable label for the collapsible stdout group header (falls back to `step`). */
  label?: string;
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

/** Pure: HH:MM:SS wall clock (UTC in CI), for step group headers. */
export function clockNow(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Pure: GitHub Actions collapsible group header (one `::group::` line per step). */
export function groupHeader(label: string, clock: string): string {
  return `::group::▶ ${label}  [${clock}]`;
}

/** Closes the most recent `::group::`. */
export const GROUP_FOOTER = "::endgroup::";

/** Per-tool: which input field carries the one piece of context worth showing. */
const TOOL_ARG_KEYS: Record<string, string> = {
  Read: "file_path",
  Edit: "file_path",
  Write: "file_path",
  NotebookEdit: "notebook_path",
  Bash: "command",
  Grep: "pattern",
  Glob: "pattern",
  Skill: "command",
  Agent: "description",
};

/** Pure: collapse whitespace and clip to n chars with an ellipsis. */
export function truncate(s: string, n: number): string {
  const oneLine = s.replace(/\s+/g, " ").trim();
  return oneLine.length > n ? oneLine.slice(0, n - 1) + "…" : oneLine;
}

/** Pure: compact one-line summary of a tool_use block (icon + name + key arg). */
export function toolSummary(name: string, input: Record<string, unknown>): string {
  const key = TOOL_ARG_KEYS[name];
  const raw = key && typeof input?.[key] === "string" ? (input[key] as string) : "";
  const arg = raw ? truncate(raw, 80) : "";
  return arg ? `🔧 ${name}  ${arg}` : `🔧 ${name}`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Pure: render one stream-json event as compact, indented stdout lines. `[]` = skip. */
export function formatEvent(ev: any): string[] {
  if (!ev || typeof ev !== "object") return [];
  if (ev.type === "assistant" && Array.isArray(ev.message?.content)) {
    const out: string[] = [];
    for (const b of ev.message.content) {
      if (b?.type === "text" && typeof b.text === "string" && b.text.trim()) {
        out.push(`  💬 ${truncate(b.text, 120)}`);
      } else if (b?.type === "tool_use" && typeof b.name === "string") {
        out.push(`  ${toolSummary(b.name, b.input ?? {})}`);
      }
    }
    return out;
  }
  if (ev.type === "user" && Array.isArray(ev.message?.content)) {
    const out: string[] = [];
    for (const b of ev.message.content) {
      if (b?.type === "tool_result" && b.is_error) {
        const txt =
          typeof b.content === "string"
            ? b.content
            : Array.isArray(b.content)
              ? b.content.map((c: any) => c?.text ?? "").join(" ")
              : "";
        out.push(`  ⚠️ tool error: ${truncate(txt, 120)}`);
      }
    }
    return out;
  }
  return [];
}

/** Pure: always-visible one-line outcome, emitted after the group closes. */
export function resultSummary(label: string, ev: any): string {
  const ok = ev?.subtype === "success" && !ev?.is_error;
  const turns = ev?.num_turns;
  const secs = typeof ev?.duration_ms === "number" ? Math.round(ev.duration_ms / 1000) : undefined;
  const cost = typeof ev?.total_cost_usd === "number" ? ev.total_cost_usd.toFixed(2) : undefined;
  const parts = [
    turns !== undefined ? `${turns} turns` : null,
    secs !== undefined ? `${secs}s` : null,
    cost !== undefined ? `$${cost}` : null,
  ].filter(Boolean);
  return `${ok ? "✓" : "✗"} ${label}${parts.length ? " · " + parts.join(" · ") : ""}`;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Thin I/O shell: spawn `claude`, write the raw stream-json to the log file (the
 * debug artifact) while emitting only a compact, parsed summary to stdout (the
 * GitHub Actions view). Verified via dry-run end-to-end runs, not unit tests.
 */
export async function runClaude(o: ClaudeOptions): Promise<string> {
  const runId = o.runId ?? "local";
  const step = o.step ?? "step";
  const label = o.label ?? step;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let resultEvent: any = null;

  // Open a collapsible group; the verbose detail lives inside it, the outcome
  // is emitted after it closes so it stays visible when the group is collapsed.
  process.stdout.write(groupHeader(label, clockNow()) + "\n");

  const handle = (l: string) => {
    lines.push(l); // full set preserved for extractResult; raw text already in the artifact
    if (!l.trim()) return;
    try {
      const ev = JSON.parse(l);
      if (ev?.type === "result") resultEvent = ev;
      for (const out of formatEvent(ev)) process.stdout.write(out + "\n");
    } catch {
      // non-JSON line: kept verbatim in the log artifact via sink, skipped on stdout
    }
  };

  for await (const chunk of proc.stdout as unknown as AsyncIterable<Uint8Array>) {
    const text = decoder.decode(chunk);
    sink.write(text);
    buffered += text;
    const parts = buffered.split("\n");
    buffered = parts.pop() ?? "";
    for (const l of parts) handle(l);
  }
  if (buffered) handle(buffered);
  sink.end();

  process.stdout.write(GROUP_FOOTER + "\n");

  const code = await proc.exited;
  if (resultEvent) process.stdout.write(resultSummary(label, resultEvent) + "\n");
  if (code !== 0) {
    process.stdout.write(`✗ ${label} — claude exited ${code}; see ${file}\n`);
    throw new Error(`claude exited ${code} (step ${step}); see ${file}`);
  }
  return extractResult(lines);
}
