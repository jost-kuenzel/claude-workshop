import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { Database } from "bun:sqlite";
import { createTestDb, seedUser } from "@/test/db-helpers";
import { makeRequest, makeAuthCookie, ADMIN_PAYLOAD, VIEWER_PAYLOAD } from "@/test/request-helpers";

let testDb: Database;

mock.module("@/lib/db", () => ({ getDb: () => testDb }));

const { GET } = await import("@/app/api/auth/me/route");

beforeEach(() => {
  testDb = createTestDb();
});

afterEach(() => {
  testDb.close();
});

describe("GET /api/auth/me", () => {
  it("should return 401 when no cookie", async () => {
    const req = makeRequest("/api/auth/me");

    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 401 for invalid token", async () => {
    const req = makeRequest("/api/auth/me", { cookie: "crm_token=invalid.token.here" });

    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 200 with user payload for valid admin token", async () => {
    await seedUser(testDb, ADMIN_PAYLOAD);

    const req = makeRequest("/api/auth/me", { cookie: makeAuthCookie(ADMIN_PAYLOAD) });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toEqual({
      id: ADMIN_PAYLOAD.userId,
      email: ADMIN_PAYLOAD.email,
      name: ADMIN_PAYLOAD.name,
      role: ADMIN_PAYLOAD.role,
    });
  });

  it("should return 200 with user payload for valid viewer token", async () => {
    await seedUser(testDb, VIEWER_PAYLOAD);

    const req = makeRequest("/api/auth/me", { cookie: makeAuthCookie(VIEWER_PAYLOAD) });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toEqual({
      id: VIEWER_PAYLOAD.userId,
      email: VIEWER_PAYLOAD.email,
      name: VIEWER_PAYLOAD.name,
      role: VIEWER_PAYLOAD.role,
    });
  });
});
