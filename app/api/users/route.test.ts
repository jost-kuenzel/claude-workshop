import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { Database } from "bun:sqlite";
import { createTestDb, seedUser } from "@/test/db-helpers";
import { makeRequest, makeAuthCookie, ADMIN_PAYLOAD, VIEWER_PAYLOAD } from "@/test/request-helpers";

let testDb: Database;

mock.module("@/lib/db", () => ({ getDb: () => testDb }));

const { GET } = await import("@/app/api/users/route");

beforeEach(() => {
  testDb = createTestDb();
});

afterEach(() => {
  testDb.close();
});

describe("GET /api/users", () => {
  it("should return 401 without auth", async () => {
    const req = makeRequest("/api/users", {
      method: "GET",
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 403 for viewer role", async () => {
    await seedUser(testDb, VIEWER_PAYLOAD);

    const req = makeRequest("/api/users", {
      method: "GET",
      cookie: makeAuthCookie(VIEWER_PAYLOAD),
    });

    const res = await GET(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Forbidden");
  });

  it("should return paginated list for admin", async () => {
    await seedUser(testDb, ADMIN_PAYLOAD);

    for (let i = 0; i < 15; i++) {
      await seedUser(testDb, {
        email: `user${i}@example.com`,
        name: `User ${i}`,
        role: i % 2 === 0 ? "admin" : "viewer",
      });
    }

    const req = makeRequest("/api/users?page=2&limit=5", {
      method: "GET",
      cookie: makeAuthCookie(ADMIN_PAYLOAD),
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.users).toHaveLength(5);
    expect(data.total).toBe(16);
    expect(data.page).toBe(2);
    expect(data.limit).toBe(5);
  }, 30000);

  it("should not include password field in any returned user", async () => {
    await seedUser(testDb, ADMIN_PAYLOAD);
    await seedUser(testDb, {
      email: "test@example.com",
      password: "secretpassword",
      name: "Test User",
      role: "viewer",
    });

    const req = makeRequest("/api/users", {
      method: "GET",
      cookie: makeAuthCookie(ADMIN_PAYLOAD),
    });

    const res = await GET(req);
    const data = await res.json();

    data.users.forEach((user: Record<string, unknown>) => {
      expect(user).not.toHaveProperty("password");
    });
  });
});
