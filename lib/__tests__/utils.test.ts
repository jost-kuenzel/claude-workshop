import { describe, it, expect } from "bun:test";
import { cn } from "@/lib/utils";

describe("cn utility", () => {
  it("should merge classes", () => {
    const result = cn("class1", "class2");
    expect(result).toContain("class1");
    expect(result).toContain("class2");
  });

  it("should drop falsy values", () => {
    const result = cn("class1", null, undefined, false, "class2");
    expect(result).toContain("class1");
    expect(result).toContain("class2");
    expect(result).not.toContain("null");
    expect(result).not.toContain("undefined");
    expect(result).not.toContain("false");
  });

  it("should resolve Tailwind conflicts", () => {
    // Tailwind merge should handle conflicts like p-2 vs p-4
    const result = cn("p-2", "p-4");
    expect(result).toBe("p-4"); // Last one wins
  });
});
