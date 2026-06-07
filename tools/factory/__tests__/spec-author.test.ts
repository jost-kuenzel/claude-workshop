import { expect, test } from "bun:test";
import {
  slugify,
  specFilename,
  buildFrontmatter,
  viewIssueArgs,
  commitSpecArgs,
  issueFromSpecPath,
} from "../spec-author";
import { validateSpecFrontmatter } from "../../hooks/factory-spec-frontmatter";

test("slugify lowercases, strips punctuation, hyphenates", () => {
  expect(slugify("Export CSV (v2)!")).toBe("export-csv-v2");
  expect(slugify("  Multiple   spaces ")).toBe("multiple-spaces");
});

test("specFilename follows YYYY-MM-DD-HHMM--issue-N--slug--design.md", () => {
  expect(specFilename("2026-06-02-1020", 6, "factory-brainstorm")).toBe(
    "docs/factory/specs/2026-06-02-1020--issue-6--factory-brainstorm--design.md"
  );
});

test("slugify is a no-op on already-clean slugs", () => {
  expect(slugify("already-clean-slug")).toBe("already-clean-slug");
});

test("slugify on all-punctuation yields empty string", () => {
  expect(slugify("!@#$%")).toBe("");
});

test("buildFrontmatter emits a valid spec frontmatter block", () => {
  const fm = buildFrontmatter({ name: "x", description: "y", issue: 6 });
  expect(fm.startsWith("---\n")).toBe(true);
  expect(fm).toContain("issue: 6");
  expect(fm).toContain('name: "x"');
  expect(fm).toContain('description: "y"');
  const path = "docs/factory/specs/2026-06-02-1020--issue-6--x--design.md";
  expect(validateSpecFrontmatter(path, fm + "\n# body").ok).toBe(true);
});

test("buildFrontmatter quotes values containing colons and quotes", () => {
  const fm = buildFrontmatter({ name: "x", description: 'Add export: CSV and "PDF"', issue: 7 });
  expect(fm).toContain('description: "Add export: CSV and \\"PDF\\""');
  const path = "docs/factory/specs/2026-06-02-1020--issue-7--x--design.md";
  expect(validateSpecFrontmatter(path, fm + "\n# body").ok).toBe(true);
});

test("viewIssueArgs reads title+body as json", () => {
  expect(viewIssueArgs(6)).toEqual(["issue", "view", "6", "--json", "title,body"]);
});

test("commitSpecArgs returns all three sub-arrays with correct issue number", () => {
  const specPath = "docs/factory/specs/2026-06-02-1020--issue-6--factory-brainstorm--design.md";
  const result = commitSpecArgs(specPath);
  expect(result.add).toEqual(["add", specPath]);
  expect(result.commit).toEqual(["commit", "-m", "factory: spec for issue 6"]);
  expect(result.push).toEqual(["push", "origin", "main"]);
});

test("issueFromSpecPath extracts issue number from a valid spec path", () => {
  expect(
    issueFromSpecPath("docs/factory/specs/2026-06-02-1020--issue-6--factory-brainstorm--design.md")
  ).toBe(6);
  expect(
    issueFromSpecPath("docs/factory/specs/2026-01-15-0900--issue-123--some-feature--design.md")
  ).toBe(123);
});

test("issueFromSpecPath throws when path lacks --issue-N-- segment", () => {
  expect(() => issueFromSpecPath("docs/factory/specs/no-issue-here.md")).toThrow(
    "cannot find --issue-N-- in spec path"
  );
});
