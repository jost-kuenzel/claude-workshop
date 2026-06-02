import { test, expect, describe } from "bun:test";
import {
  reactIssueArgs,
  reactCommentArgs,
  createPrArgs,
  issueCommentArgs,
  runProcess,
} from "./github";

describe("reactIssueArgs", () => {
  test("builds a gh api POST to the issue reactions endpoint", () => {
    expect(reactIssueArgs(42, "+1")).toEqual([
      "api",
      "--method",
      "POST",
      "repos/{owner}/{repo}/issues/42/reactions",
      "-f",
      "content=+1",
    ]);
  });
});

describe("reactCommentArgs", () => {
  test("targets the issue-comment reactions endpoint by comment id", () => {
    expect(reactCommentArgs(777, "hooray")).toEqual([
      "api",
      "--method",
      "POST",
      "repos/{owner}/{repo}/issues/comments/777/reactions",
      "-f",
      "content=hooray",
    ]);
  });
});

describe("createPrArgs", () => {
  test("passes base, head, title and body through", () => {
    expect(
      createPrArgs({
        base: "main",
        head: "factory/issue-1--x",
        title: "feat: x",
        body: "Closes #1",
      })
    ).toEqual([
      "pr",
      "create",
      "--base",
      "main",
      "--head",
      "factory/issue-1--x",
      "--title",
      "feat: x",
      "--body",
      "Closes #1",
    ]);
  });
});

describe("issueCommentArgs", () => {
  test("posts a comment to an issue or PR number", () => {
    expect(issueCommentArgs(5, "cap reached")).toEqual([
      "issue",
      "comment",
      "5",
      "--body",
      "cap reached",
    ]);
  });
});

describe("runProcess", () => {
  test("dry-run logs command and returns empty string", async () => {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(" "));
    const result = await runProcess("git", ["status"], { dryRun: true });
    console.log = origLog;
    expect(result).toBe("");
    expect(logs).toEqual(["[dry-run] git status"]);
  });

  test("runs a real process and returns trimmed stdout", async () => {
    const result = await runProcess("echo", ["hello"]);
    expect(result).toBe("hello");
  });

  test("throws with exit code when process fails", async () => {
    await expect(runProcess("false", [])).rejects.toThrow(/false  failed \(exit \d+\)/);
  });
});
