import { test, expect, describe } from "bun:test";
import { parsePlan, firstUnchecked, checkOffTask } from "./plan";

const SAMPLE = `# Demo Plan

## Task Checklist

- [ ] Task 1: Add the model
- [x] Task 2: Wire the route

---

### Task 1: Add the model

**Files:** src/model.ts
- [ ] Step 1: failing test

### Task 2: Wire the route

Body of task two.
`;

describe("parsePlan", () => {
  test("returns one entry per checklist line with index, title, checked", () => {
    const tasks = parsePlan(SAMPLE);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({ index: 1, title: "Add the model", checked: false });
    expect(tasks[1]).toMatchObject({ index: 2, title: "Wire the route", checked: true });
  });

  test("attaches the matching ### Task N section body to each task", () => {
    const tasks = parsePlan(SAMPLE);
    expect(tasks[0].body).toContain("### Task 1: Add the model");
    expect(tasks[0].body).toContain("**Files:** src/model.ts");
    expect(tasks[0].body).not.toContain("### Task 2");
    expect(tasks[1].body).toContain("Body of task two.");
  });

  test("throws a typed error when the Task Checklist section is missing", () => {
    expect(() => parsePlan("# No checklist here\n\njust prose")).toThrow(/Task Checklist/);
  });
});

describe("firstUnchecked", () => {
  test("returns the lowest-index unchecked task", () => {
    expect(firstUnchecked(parsePlan(SAMPLE))?.index).toBe(1);
  });
  test("returns undefined when all tasks are checked", () => {
    const md = SAMPLE.replace("- [ ] Task 1", "- [x] Task 1");
    expect(firstUnchecked(parsePlan(md))).toBeUndefined();
  });
});

describe("checkOffTask", () => {
  test("flips only the targeted checklist line to checked", () => {
    const out = checkOffTask(SAMPLE, 1);
    expect(out).toContain("- [x] Task 1: Add the model");
    expect(out).toContain("- [x] Task 2: Wire the route");
    // detail-section step checkbox is untouched
    expect(out).toContain("- [ ] Step 1: failing test");
  });
  test("throws when the task index is not in the checklist", () => {
    expect(() => checkOffTask(SAMPLE, 9)).toThrow(/Task 9/);
  });
});
