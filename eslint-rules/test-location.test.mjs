import { test, expect, describe } from "bun:test";
import testLocationRule from "./test-location.mjs";

/**
 * Minimal rule tester that invokes the rule's create() handler
 * and collects any reports without spinning up the full ESLint engine.
 */
function runRule(filename) {
  const reports = [];
  const context = {
    filename,
    report(descriptor) {
      reports.push(descriptor);
    },
  };
  const visitor = testLocationRule.create(context);
  visitor.Program();
  return reports;
}

describe("test-location ESLint rule", () => {
  test("reports an error for a test file NOT inside __tests__/", () => {
    const reports = runRule("/project/lib/auth.test.ts");
    expect(reports).toHaveLength(1);
    expect(reports[0].message).toBe("Test files must live inside a __tests__/ folder.");
  });

  test("reports no error for a test file inside __tests__/", () => {
    const reports = runRule("/project/lib/__tests__/auth.test.ts");
    expect(reports).toHaveLength(0);
  });

  test("reports no error when __tests__ appears anywhere in the path", () => {
    const reports = runRule("/project/scripts/factory/__tests__/plan.test.ts");
    expect(reports).toHaveLength(0);
  });

  test("meta has correct type", () => {
    expect(testLocationRule.meta.type).toBe("problem");
  });
});
