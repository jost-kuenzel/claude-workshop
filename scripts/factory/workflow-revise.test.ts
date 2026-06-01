import { test, expect, describe } from "bun:test";
import { nextReviseCount, isOverCap } from "./workflow-revise";

describe("revise cap", () => {
  test("increments the stored count", () => {
    expect(nextReviseCount(0)).toBe(1);
    expect(nextReviseCount(4)).toBe(5);
  });
  test("is over cap strictly above 5", () => {
    expect(isOverCap(5)).toBe(false);
    expect(isOverCap(6)).toBe(true);
  });
});
