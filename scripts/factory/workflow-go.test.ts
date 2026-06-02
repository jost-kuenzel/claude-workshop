import { test, expect, describe } from "bun:test";
import { matchSpecForIssue, planFilename, stampNow } from "./workflow-go";

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

describe("plan path naming", () => {
  test("planFilename builds the dated plan path", () => {
    expect(planFilename("2026-06-02-1124", 8, "my-slug")).toBe(
      "docs/factory/plans/2026-06-02-1124--issue-8--my-slug--plan.md"
    );
  });
  test("stampNow formats YYYY-MM-DD-HHMM", () => {
    expect(stampNow(new Date(2026, 5, 2, 11, 24))).toBe("2026-06-02-1124");
  });
});
