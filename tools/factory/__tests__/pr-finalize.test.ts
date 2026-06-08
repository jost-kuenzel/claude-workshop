import { expect, test } from "bun:test";
import { buildFinalizePrompt } from "../pr-finalize";

test("buildFinalizePrompt summarises the PR and keeps the Closes line", () => {
  const prompt = buildFinalizePrompt(42, "docs/factory/plans/plan.md", 39);
  expect(prompt).toContain("pull request #42");
  expect(prompt).toContain("docs/factory/plans/plan.md");
  expect(prompt).toContain("Closes #<issue>");
  expect(prompt).toContain("gh pr edit");
});

test("buildFinalizePrompt instructs the agent to embed evidence images under the issue path", () => {
  const prompt = buildFinalizePrompt(42, "docs/factory/plans/plan.md", 39);
  expect(prompt).toContain("docs/factory/evidence/issue-39/");
  expect(prompt).toContain("## Verification evidence");
  expect(prompt).toContain("raw.githubusercontent.com");
});

test("buildFinalizePrompt threads the issue number into the evidence path", () => {
  const prompt = buildFinalizePrompt(7, "docs/factory/plans/plan.md", 123);
  expect(prompt).toContain("docs/factory/evidence/issue-123/");
});
