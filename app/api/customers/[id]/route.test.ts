import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { Database } from "bun:sqlite";
import { createTestDb, seedUser, seedCustomer } from "@/test/db-helpers";
import { makeRequest, makeAuthCookie, ADMIN_PAYLOAD, VIEWER_PAYLOAD } from "@/test/request-helpers";

let testDb: Database;

mock.module("@/lib/db", () => ({ getDb: () => testDb }));

const { GET, PUT, DELETE } = await import("@/app/api/customers/[id]/route");

beforeEach(() => {
  testDb = createTestDb();
});

afterEach(() => {
  testDb.close();
});

describe("GET /api/customers/[id]", () => {
  it("should return 401 without auth", async () => {
    const req = makeRequest("/api/customers/1", {
      method: "GET",
    });

    const res = await GET(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 404 for missing customer", async () => {
    await seedUser(testDb, ADMIN_PAYLOAD);

    const req = makeRequest("/api/customers/999", {
      method: "GET",
      cookie: makeAuthCookie(ADMIN_PAYLOAD),
    });

    const res = await GET(req, { params: Promise.resolve({ id: "999" }) });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Not found");
  });

  it("should return 200 for existing customer", async () => {
    await seedUser(testDb, ADMIN_PAYLOAD);
    const { lastInsertRowid } = await seedCustomer(testDb, {
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
    });

    const req = makeRequest(`/api/customers/${lastInsertRowid}`, {
      method: "GET",
      cookie: makeAuthCookie(ADMIN_PAYLOAD),
    });

    const res = await GET(req, { params: Promise.resolve({ id: String(lastInsertRowid) }) });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.firstName).toBe("John");
    expect(data.lastName).toBe("Doe");
    expect(data.email).toBe("john@example.com");
  });

  it("should be accessible by both admin and viewer roles", async () => {
    await seedUser(testDb, VIEWER_PAYLOAD);
    const { lastInsertRowid } = await seedCustomer(testDb);

    const req = makeRequest(`/api/customers/${lastInsertRowid}`, {
      method: "GET",
      cookie: makeAuthCookie(VIEWER_PAYLOAD),
    });

    const res = await GET(req, { params: Promise.resolve({ id: String(lastInsertRowid) }) });
    expect(res.status).toBe(200);
  });
});

describe("PUT /api/customers/[id]", () => {
  it("should return 401 without auth", async () => {
    const req = makeRequest("/api/customers/1", {
      method: "PUT",
      body: { firstName: "Updated" },
    });

    const res = await PUT(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 403 for viewer role", async () => {
    await seedUser(testDb, VIEWER_PAYLOAD);
    const { lastInsertRowid } = await seedCustomer(testDb);

    const req = makeRequest(`/api/customers/${lastInsertRowid}`, {
      method: "PUT",
      body: { firstName: "Updated" },
      cookie: makeAuthCookie(VIEWER_PAYLOAD),
    });

    const res = await PUT(req, { params: Promise.resolve({ id: String(lastInsertRowid) }) });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Forbidden");
  });

  it("should update and return customer for admin", async () => {
    await seedUser(testDb, ADMIN_PAYLOAD);
    const { lastInsertRowid } = await seedCustomer(testDb, {
      firstName: "Original",
    });

    const req = makeRequest(`/api/customers/${lastInsertRowid}`, {
      method: "PUT",
      body: {
        firstName: "Updated",
        lastName: "Doe",
        company: "Acme Corp",
        email: "updated@example.com",
        phone: "1234567890",
        status: "active",
        lastContact: "2024-01-01",
      },
      cookie: makeAuthCookie(ADMIN_PAYLOAD),
    });

    const res = await PUT(req, { params: Promise.resolve({ id: String(lastInsertRowid) }) });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.firstName).toBe("Updated");
    expect(data.email).toBe("updated@example.com");
  });
});

describe("DELETE /api/customers/[id]", () => {
  it("should return 401 without auth", async () => {
    const req = makeRequest("/api/customers/1", {
      method: "DELETE",
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 403 for viewer role", async () => {
    await seedUser(testDb, VIEWER_PAYLOAD);
    const { lastInsertRowid } = await seedCustomer(testDb);

    const req = makeRequest(`/api/customers/${lastInsertRowid}`, {
      method: "DELETE",
      cookie: makeAuthCookie(VIEWER_PAYLOAD),
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: String(lastInsertRowid) }) });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Forbidden");
  });

  it('should delete and return { message: "Deleted" } for admin', async () => {
    await seedUser(testDb, ADMIN_PAYLOAD);
    const { lastInsertRowid } = await seedCustomer(testDb);

    const req = makeRequest(`/api/customers/${lastInsertRowid}`, {
      method: "DELETE",
      cookie: makeAuthCookie(ADMIN_PAYLOAD),
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: String(lastInsertRowid) }) });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.message).toBe("Deleted");
  });

  it("should return 404 for subsequent GET after deletion", async () => {
    await seedUser(testDb, ADMIN_PAYLOAD);
    const { lastInsertRowid } = await seedCustomer(testDb);

    const deleteReq = makeRequest(`/api/customers/${lastInsertRowid}`, {
      method: "DELETE",
      cookie: makeAuthCookie(ADMIN_PAYLOAD),
    });
    await DELETE(deleteReq, { params: Promise.resolve({ id: String(lastInsertRowid) }) });

    const getReq = makeRequest(`/api/customers/${lastInsertRowid}`, {
      method: "GET",
      cookie: makeAuthCookie(ADMIN_PAYLOAD),
    });
    const getRes = await GET(getReq, { params: Promise.resolve({ id: String(lastInsertRowid) }) });
    expect(getRes.status).toBe(404);
  });
});
