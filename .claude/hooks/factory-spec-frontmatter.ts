#!/usr/bin/env bun

export interface FmCheck {
  ok: boolean;
  error?: string;
}

const SPEC_GLOB = /docs\/factory\/specs\/.*\.md$/;

/** Pure: validate that a spec file's frontmatter carries a positive-integer `issue:`. */
export function validateSpecFrontmatter(filePath: string, content: string): FmCheck {
  if (!SPEC_GLOB.test(filePath)) return { ok: true };

  const fm = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!fm) return { ok: false, error: `spec ${filePath} has no YAML frontmatter block` };

  const line = fm[1].split("\n").find((l) => /^issue:/.test(l.trim()));
  if (!line)
    return { ok: false, error: `spec ${filePath} frontmatter is missing required key "issue:"` };

  const value = line.split(":")[1]?.trim();
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    return {
      ok: false,
      error: `spec ${filePath} "issue:" must be a positive integer (got "${value}")`,
    };
  }
  return { ok: true };
}

// I/O shell — runs only when invoked directly.
if (import.meta.main) {
  const event = JSON.parse(await Bun.stdin.text());
  const filePath: string = event.tool_input?.file_path ?? "";
  let content = "";
  try {
    content = await Bun.file(filePath).text();
  } catch {
    process.exit(0); // file unreadable / deleted — nothing to validate
  }
  const result = validateSpecFrontmatter(filePath, content);
  if (!result.ok) {
    process.stderr.write(result.error ?? "invalid spec frontmatter");
    process.exit(2); // feed the error back to Claude so it fixes the spec
  }
  process.exit(0);
}
