import { test, expect, describe } from "bun:test";
import { matchSpecForIssue } from "./workflow-go";

describe("matchSpecForIssue", () => {
  const specs = [
    { path: "a-design.md", content: "---\nissue: 7\n---\nx" },
    { path: "b-design.md", content: "---\nissue: 42\n---\ny" },
    { path: "c-design.md", content: "no frontmatter" },
  ];
  test("returns the spec path whose frontmatter issue matches", () => {
    expect(matchSpecForIssue(specs, 42)).toBe("b-design.md");
  });
  test("returns undefined when no spec matches", () => {
    expect(matchSpecForIssue(specs, 99)).toBeUndefined();
  });
});
