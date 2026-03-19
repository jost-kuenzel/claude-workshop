// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock better-sqlite3 so no real SQLite file is touched
vi.mock("better-sqlite3", () => {
  function MockDatabase() {
    return {
      pragma: vi.fn(),
      exec: vi.fn(),
      prepare: vi.fn(() => ({
        get: vi.fn(),
        all: vi.fn(() => []),
        run: vi.fn(() => ({ lastInsertRowid: 1 })),
      })),
    };
  }

  return { default: MockDatabase };
});

describe("getDb()", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns a database instance", async () => {
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    expect(db).toBeDefined();
  });

  it("returns the same instance on subsequent calls (singleton)", async () => {
    const { getDb } = await import("@/lib/db");
    const db1 = getDb();
    const db2 = getDb();
    expect(db1).toBe(db2);
  });

  it("exposes a prepare method", async () => {
    const { getDb } = await import("@/lib/db");
    const db = getDb();
    expect(typeof db.prepare).toBe("function");
  });
});
