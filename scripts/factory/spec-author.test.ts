import { expect, test } from "bun:test";
import { slugify, specFilename } from "./spec-author";

test("slugify lowercases, strips punctuation, hyphenates", () => {
  expect(slugify("Export CSV (v2)!")).toBe("export-csv-v2");
  expect(slugify("  Multiple   spaces ")).toBe("multiple-spaces");
});

test("specFilename follows YYYY-MM-DD-HHMM--issue-N--slug--design.md", () => {
  expect(specFilename("2026-06-02-1020", 6, "factory-brainstorm")).toBe(
    "docs/superpowers/specs/2026-06-02-1020--issue-6--factory-brainstorm--design.md"
  );
});

test("slugify is a no-op on already-clean slugs", () => {
  expect(slugify("already-clean-slug")).toBe("already-clean-slug");
});

test("slugify on all-punctuation yields empty string", () => {
  expect(slugify("!@#$%")).toBe("");
});
