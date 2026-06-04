import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { Database } from "bun:sqlite";
import { createTestDb, seedUser, seedCustomer } from "@/test/db-helpers";
import { makeRequest, makeAuthCookie, ADMIN_PAYLOAD, VIEWER_PAYLOAD } from "@/test/request-helpers";

let testDb: Database;

mock.module("@/lib/db", () => ({ getDb: () => testDb }));

const { GET, POST } = await import("@/app/api/customers/route");

beforeEach(() => {
  testDb = createTestDb();
});

afterEach(() => {
  testDb.close();
});

describe("GET /api/customers", () => {
  it("should return 401 without auth", async () => {
    const req = makeRequest("/api/customers", {
      method: "GET",
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("should return pagination with page/limit/total", async () => {
    await seedUser(testDb, ADMIN_PAYLOAD);

    for (let i = 0; i < 15; i++) {
      await seedCustomer(testDb, {
        email: `customer${i}@example.com`,
      });
    }

    const req = makeRequest("/api/customers?page=2&limit=5", {
      method: "GET",
      cookie: makeAuthCookie(ADMIN_PAYLOAD),
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.customers).toHaveLength(5);
    expect(data.total).toBe(15);
    expect(data.page).toBe(2);
    expect(data.limit).toBe(5);
  });

  it("should be accessible by both admin and viewer roles", async () => {
    await seedUser(testDb, VIEWER_PAYLOAD);
    await seedCustomer(testDb);

    const req = makeRequest("/api/customers", {
      method: "GET",
      cookie: makeAuthCookie(VIEWER_PAYLOAD),
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.customers).toHaveLength(1);
  });
});

describe("POST /api/customers", () => {
  it("should return 401 without auth", async () => {
    const req = makeRequest("/api/customers", {
      method: "POST",
      body: {
        firstName: "John",
        lastName: "Doe",
        company: "Acme Corp",
        email: "john@example.com",
        phone: "1234567890",
        status: "active",
        lastContact: "2024-01-01",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 403 for viewer role", async () => {
    await seedUser(testDb, VIEWER_PAYLOAD);

    const req = makeRequest("/api/customers", {
      method: "POST",
      body: {
        firstName: "John",
        lastName: "Doe",
        company: "Acme Corp",
        email: "john@example.com",
        phone: "1234567890",
        status: "active",
        lastContact: "2024-01-01",
      },
      cookie: makeAuthCookie(VIEWER_PAYLOAD),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Forbidden");
  });

  it("should return 201 + customer body for admin", async () => {
    await seedUser(testDb, ADMIN_PAYLOAD);

    const customerData = {
      firstName: "John",
      lastName: "Doe",
      company: "Acme Corp",
      email: "john@example.com",
      phone: "1234567890",
      status: "active",
      lastContact: "2024-01-01",
    };

    const req = makeRequest("/api/customers", {
      method: "POST",
      body: customerData,
      cookie: makeAuthCookie(ADMIN_PAYLOAD),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.firstName).toBe(customerData.firstName);
    expect(data.lastName).toBe(customerData.lastName);
    expect(data.email).toBe(customerData.email);
  });
});
