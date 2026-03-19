import { describe, it, expect, vi, beforeEach } from "vitest";
import type { JwtPayload } from "@/lib/types";

// ── db mock ──────────────────────────────────────────────────────────────────
const mockSelectGet = vi.fn();
const mockUpdateRun = vi.fn();
const mockDeleteRun = vi.fn();

const mockPrepare = vi.fn((sql: string) => {
  if (sql.includes("UPDATE")) return { run: mockUpdateRun };
  if (sql.includes("DELETE")) return { run: mockDeleteRun };
  // SELECT
  return { get: mockSelectGet };
});

vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({ prepare: mockPrepare })) }));

// ── auth mock ────────────────────────────────────────────────────────────────
const mockVerifyToken = vi.fn<() => Promise<JwtPayload | null>>();
const mockGetTokenFromRequest = vi.fn<() => string | null>();

vi.mock("@/lib/auth", () => ({
  verifyToken: mockVerifyToken,
  getTokenFromRequest: mockGetTokenFromRequest,
}));

// ── helpers ──────────────────────────────────────────────────────────────────
import type { NextRequest } from "next/server";

function makeRequest(method: string, body?: Record<string, unknown>): NextRequest {
  return new Request(`http://localhost/api/customers/1`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as NextRequest;
}

const params = Promise.resolve({ id: "1" });

const adminPayload: JwtPayload = { userId: 1, email: "admin@crm.local", name: "Admin", role: "admin" };
const viewerPayload: JwtPayload = { userId: 2, email: "viewer@crm.local", name: "Viewer", role: "viewer" };

const sampleCustomer = {
  id: 1,
  firstName: "Jane",
  lastName: "Doe",
  company: "ACME",
  email: "jane@acme.com",
  phone: "555-1234",
  status: "active",
  lastContact: "2025-01-01",
  createdAt: "2025-01-01T00:00:00",
};

const customerBody = {
  firstName: "Jane",
  lastName: "Doe",
  company: "ACME",
  email: "jane@acme.com",
  phone: "555-1234",
  status: "active",
  lastContact: "2025-01-01",
};

describe("GET /api/customers/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with the customer for authenticated user", async () => {
    mockGetTokenFromRequest.mockReturnValue("token");
    mockVerifyToken.mockResolvedValue(viewerPayload);
    mockSelectGet.mockReturnValue(sampleCustomer);

    const { GET } = await import("@/app/api/customers/[id]/route");
    const res = await GET(makeRequest("GET"), { params });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(1);
  });

  it("returns 401 when no token", async () => {
    mockGetTokenFromRequest.mockReturnValue(null);
    mockVerifyToken.mockResolvedValue(null);

    const { GET } = await import("@/app/api/customers/[id]/route");
    const res = await GET(makeRequest("GET"), { params });

    expect(res.status).toBe(401);
  });

  it("returns 404 when customer does not exist", async () => {
    mockGetTokenFromRequest.mockReturnValue("token");
    mockVerifyToken.mockResolvedValue(adminPayload);
    mockSelectGet.mockReturnValue(undefined);

    const { GET } = await import("@/app/api/customers/[id]/route");
    const res = await GET(makeRequest("GET"), { params });

    expect(res.status).toBe(404);
  });
});

describe("PUT /api/customers/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 when admin updates a customer", async () => {
    mockGetTokenFromRequest.mockReturnValue("token");
    mockVerifyToken.mockResolvedValue(adminPayload);
    mockSelectGet.mockReturnValue(sampleCustomer);

    const { PUT } = await import("@/app/api/customers/[id]/route");
    const res = await PUT(makeRequest("PUT", customerBody), { params });

    expect(res.status).toBe(200);
    expect(mockUpdateRun).toHaveBeenCalledOnce();
  });

  it("returns 401 when no token", async () => {
    mockGetTokenFromRequest.mockReturnValue(null);
    mockVerifyToken.mockResolvedValue(null);

    const { PUT } = await import("@/app/api/customers/[id]/route");
    const res = await PUT(makeRequest("PUT", customerBody), { params });

    expect(res.status).toBe(401);
  });

  it("returns 403 when viewer tries to update", async () => {
    mockGetTokenFromRequest.mockReturnValue("token");
    mockVerifyToken.mockResolvedValue(viewerPayload);

    const { PUT } = await import("@/app/api/customers/[id]/route");
    const res = await PUT(makeRequest("PUT", customerBody), { params });

    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/customers/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 when admin deletes a customer", async () => {
    mockGetTokenFromRequest.mockReturnValue("token");
    mockVerifyToken.mockResolvedValue(adminPayload);

    const { DELETE } = await import("@/app/api/customers/[id]/route");
    const res = await DELETE(makeRequest("DELETE"), { params });

    expect(res.status).toBe(200);
    expect(mockDeleteRun).toHaveBeenCalledOnce();
  });

  it("returns 401 when no token", async () => {
    mockGetTokenFromRequest.mockReturnValue(null);
    mockVerifyToken.mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/customers/[id]/route");
    const res = await DELETE(makeRequest("DELETE"), { params });

    expect(res.status).toBe(401);
  });

  it("returns 403 when viewer tries to delete", async () => {
    mockGetTokenFromRequest.mockReturnValue("token");
    mockVerifyToken.mockResolvedValue(viewerPayload);

    const { DELETE } = await import("@/app/api/customers/[id]/route");
    const res = await DELETE(makeRequest("DELETE"), { params });

    expect(res.status).toBe(403);
  });
});
