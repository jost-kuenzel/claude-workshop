import { test, expect, describe } from "bun:test";
import { planLintFix } from "../lint-fix";

describe("planLintFix", () => {
  test.each(["a.ts", "b.tsx", "c.js", "d.mjs", "e.json", "f.md"])("fixes %s", (f) => {
    const plan = planLintFix(f);
    expect(plan.shouldFix).toBe(true);
    expect(plan.commands).toEqual([
      ["bunx", "eslint", "--fix", f],
      ["bunx", "prettier", "--write", f],
    ]);
  });

  test.each(["x.py", "y.css", "z.txt", "Dockerfile", ""])("skips %s", (f) => {
    expect(planLintFix(f)).toEqual({ shouldFix: false, commands: [] });
  });

  test("matches on full path, not just basename", () => {
    expect(planLintFix("src/lib/foo.ts").shouldFix).toBe(true);
    expect(planLintFix("docs/factory/specs/bar.md").shouldFix).toBe(true);
  });
});
