import { test, expect, describe } from "bun:test";
import { validateSpecFrontmatter } from "./factory-spec-frontmatter";

const withIssue = `---
name: x
issue: 42
---
body`;

describe("validateSpecFrontmatter", () => {
  test("ignores files outside docs/superpowers/specs", () => {
    expect(validateSpecFrontmatter("src/app.ts", "whatever")).toEqual({ ok: true });
  });

  test("accepts a spec whose frontmatter has a positive integer issue", () => {
    expect(
      validateSpecFrontmatter(
        "docs/superpowers/specs/2026-06-01-1200--issue-42--x--design.md",
        withIssue
      )
    ).toEqual({ ok: true });
  });

  test("rejects a spec with no issue key", () => {
    const r = validateSpecFrontmatter("docs/superpowers/specs/x-design.md", "---\nname: x\n---\nb");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/issue/);
  });

  test("rejects a non-positive or non-integer issue", () => {
    const r = validateSpecFrontmatter(
      "docs/superpowers/specs/x-design.md",
      "---\nissue: 0\n---\nb"
    );
    expect(r.ok).toBe(false);
  });

  test("rejects a spec with no frontmatter block", () => {
    expect(validateSpecFrontmatter("docs/superpowers/specs/x-design.md", "no frontmatter").ok).toBe(
      false
    );
  });
});
