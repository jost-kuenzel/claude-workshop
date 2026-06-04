import { test, expect, describe } from "bun:test";
import {
  buildClaudeArgs,
  resolveAuthEnv,
  logPath,
  extractResult,
  clockNow,
  groupHeader,
  GROUP_FOOTER,
  truncate,
  toolSummary,
  formatEvent,
  resultSummary,
} from "../claude";

describe("buildClaudeArgs", () => {
  test("emits print + stream-json + verbose with scoped tools and prompt last", () => {
    const args = buildClaudeArgs({
      prompt: "do the thing",
      allowedTools: ["Read", "Bash(git commit:*)"],
      model: "sonnet",
      maxTurns: 50,
      permissionMode: "acceptEdits",
    });
    expect(args.slice(0, 4)).toEqual(["--print", "--output-format", "stream-json", "--verbose"]);
    expect(args).toContain("--allowedTools");
    expect(args[args.indexOf("--allowedTools") + 1]).toBe("Read,Bash(git commit:*)");
    expect(args[args.indexOf("--model") + 1]).toBe("sonnet");
    expect(args[args.indexOf("--max-turns") + 1]).toBe("50");
    expect(args[args.indexOf("--permission-mode") + 1]).toBe("acceptEdits");
    expect(args[args.length - 1]).toBe("do the thing"); // prompt is positional, last
  });

  test("omits optional flags when not provided", () => {
    const args = buildClaudeArgs({ prompt: "p", allowedTools: ["Read"] });
    expect(args).not.toContain("--model");
    expect(args).not.toContain("--max-turns");
    expect(args).not.toContain("--permission-mode");
  });
});

describe("resolveAuthEnv", () => {
  test("forwards ANTHROPIC_API_KEY when present", () => {
    expect(resolveAuthEnv({ ANTHROPIC_API_KEY: "sk-123", PATH: "/bin" })).toMatchObject({
      ANTHROPIC_API_KEY: "sk-123",
    });
  });
  test("does not invent a key when absent (subscription fallback path)", () => {
    expect(resolveAuthEnv({ PATH: "/bin" })).not.toHaveProperty("ANTHROPIC_API_KEY");
  });
});

describe("logPath", () => {
  test("builds .factory/logs/<run>--<step>.jsonl", () => {
    expect(logPath("run9", "plan-gen")).toBe(".factory/logs/run9--plan-gen.jsonl");
  });
});

describe("extractResult", () => {
  test("returns the result field from the final result event", () => {
    const lines = [
      JSON.stringify({ type: "system", subtype: "init" }),
      JSON.stringify({ type: "assistant", message: { content: "thinking" } }),
      JSON.stringify({ type: "result", subtype: "success", result: "FINAL TEXT" }),
    ];
    expect(extractResult(lines)).toBe("FINAL TEXT");
  });
  test("returns empty string when there is no result event", () => {
    expect(extractResult([JSON.stringify({ type: "system" })])).toBe("");
  });
  test("ignores non-JSON lines without throwing", () => {
    expect(extractResult(["not json", JSON.stringify({ type: "result", result: "OK" })])).toBe(
      "OK"
    );
  });
});

describe("clockNow", () => {
  test("formats HH:MM:SS with zero padding", () => {
    expect(clockNow(new Date(2026, 0, 1, 9, 3, 7))).toBe("09:03:07");
  });
});

describe("groupHeader / GROUP_FOOTER", () => {
  test("emits a ::group:: header with label and clock", () => {
    expect(groupHeader("Task 2: Add login form", "14:03:12")).toBe(
      "::group::▶ Task 2: Add login form  [14:03:12]"
    );
  });
  test("footer closes the group", () => {
    expect(GROUP_FOOTER).toBe("::endgroup::");
  });
});

describe("truncate", () => {
  test("collapses whitespace and leaves short strings intact", () => {
    expect(truncate("a   b\nc", 80)).toBe("a b c");
  });
  test("clips long strings with an ellipsis", () => {
    expect(truncate("abcdefghij", 5)).toBe("abcd…");
  });
});

describe("toolSummary", () => {
  test("shows the file path for file tools", () => {
    expect(toolSummary("Read", { file_path: "src/auth.ts" })).toBe("🔧 Read  src/auth.ts");
  });
  test("shows the command for Bash", () => {
    expect(toolSummary("Bash", { command: "git commit -m x" })).toBe("🔧 Bash  git commit -m x");
  });
  test("falls back to just the name when no known arg is present", () => {
    expect(toolSummary("Mystery", { foo: "bar" })).toBe("🔧 Mystery");
  });
});

describe("formatEvent", () => {
  test("renders assistant text as a truncated snippet", () => {
    const ev = { type: "assistant", message: { content: [{ type: "text", text: "I'll add it" }] } };
    expect(formatEvent(ev)).toEqual(["  💬 I'll add it"]);
  });
  test("renders tool_use blocks as compact tool lines", () => {
    const ev = {
      type: "assistant",
      message: {
        content: [
          { type: "tool_use", name: "Edit", input: { file_path: "src/auth.ts" } },
          { type: "tool_use", name: "Bash", input: { command: "bun test" } },
        ],
      },
    };
    expect(formatEvent(ev)).toEqual(["  🔧 Edit  src/auth.ts", "  🔧 Bash  bun test"]);
  });
  test("surfaces tool errors but skips successful tool results", () => {
    const err = {
      type: "user",
      message: { content: [{ type: "tool_result", is_error: true, content: "boom" }] },
    };
    const ok = {
      type: "user",
      message: { content: [{ type: "tool_result", content: "fine" }] },
    };
    expect(formatEvent(err)).toEqual(["  ⚠️ tool error: boom"]);
    expect(formatEvent(ok)).toEqual([]);
  });
  test("skips system and unknown events", () => {
    expect(formatEvent({ type: "system", subtype: "init" })).toEqual([]);
    expect(formatEvent(null)).toEqual([]);
  });
});

describe("resultSummary", () => {
  test("renders a success line with turns, duration and cost", () => {
    const ev = {
      type: "result",
      subtype: "success",
      num_turns: 8,
      duration_ms: 42000,
      total_cost_usd: 0.21,
    };
    expect(resultSummary("Task 2", ev)).toBe("✓ Task 2 · 8 turns · 42s · $0.21");
  });
  test("marks non-success outcomes with ✗", () => {
    const ev = { type: "result", subtype: "error_max_turns", num_turns: 50 };
    expect(resultSummary("Task 2", ev)).toBe("✗ Task 2 · 50 turns");
  });
});
