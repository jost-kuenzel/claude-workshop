import { test, expect, describe } from "bun:test";
import { buildClaudeArgs, resolveAuthEnv, logPath, extractResult } from "./claude";

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
