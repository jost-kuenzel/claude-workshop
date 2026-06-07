import { expect, test } from "bun:test";
import {
  slugify,
  specFilename,
  buildFrontmatter,
  viewIssueArgs,
  commitSpecArgs,
  issueFromSpecPath,
  truncateSlug,
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

test("truncateSlug returns slug unchanged when shorter than max", () => {
  expect(truncateSlug("short", 40)).toBe("short");
});

test("truncateSlug slices to max when no trailing hyphen", () => {
  expect(truncateSlug("abcde", 3)).toBe("abc");
});

test("truncateSlug strips trailing hyphen after slice", () => {
  // "ab-cd".slice(0, 3) = "ab-" → strip → "ab"
  expect(truncateSlug("ab-cd", 3)).toBe("ab");
});

test("truncateSlug strips multiple trailing hyphens", () => {
  // "a---b".slice(0, 3) = "a--" → strip → "a"
  expect(truncateSlug("a---b", 3)).toBe("a");
});

test("truncateSlug default max=40 cuts >40-char slug to ≤40 chars with no trailing hyphen", () => {
  const long = "a".repeat(39) + "-" + "b".repeat(10); // 50 chars; char 40 is '-'
  const result = truncateSlug(long);
  expect(result.length).toBeLessThanOrEqual(40);
  expect(result.endsWith("-")).toBe(false);
});

test("truncateSlug with exactly max chars and 40th char a hyphen strips it", () => {
  // build a 41-char string where index 39 (0-based) is '-'
  const s = "a".repeat(39) + "-x";
  const result = truncateSlug(s, 40);
  expect(result).toBe("a".repeat(39));
});
