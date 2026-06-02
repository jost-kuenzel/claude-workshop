import { expect, test } from "bun:test";
import { featureBody, bugBody, labelsFor, createIssueArgs, ensureLabelArgs } from "./issue-create";

test("featureBody renders What/Why and omits empty Constraints", () => {
  const body = featureBody({ what: "Add export", why: "Users ask for CSV" });
  expect(body).toContain("## What\n\nAdd export");
  expect(body).toContain("## Why\n\nUsers ask for CSV");
  expect(body).not.toContain("## Constraints");
});

test("featureBody includes Constraints when provided", () => {
  const body = featureBody({ what: "a", why: "b", constraints: "no new deps" });
  expect(body).toContain("## Constraints / non-goals\n\nno new deps");
});

test("bugBody renders broken/expected/where", () => {
  const body = bugBody({ broken: "crashes", expected: "no crash", where: "login" });
  expect(body).toContain("## What's broken\n\ncrashes");
  expect(body).toContain("## Expected\n\nno crash");
  expect(body).toContain("## Where\n\nlogin");
});

test("labelsFor: feature vs bug", () => {
  expect(labelsFor("feature")).toEqual(["factory-idea"]);
  expect(labelsFor("bug")).toEqual(["factory-idea", "bug"]);
});

test("createIssueArgs builds gh issue create with repeated --label", () => {
  expect(createIssueArgs({ title: "T", body: "B", labels: ["factory-idea", "bug"] })).toEqual([
    "issue",
    "create",
    "--title",
    "T",
    "--body",
    "B",
    "--label",
    "factory-idea",
    "--label",
    "bug",
  ]);
});

test("ensureLabelArgs builds a gh label create", () => {
  expect(ensureLabelArgs("bug")).toEqual(["label", "create", "bug", "--force"]);
});
