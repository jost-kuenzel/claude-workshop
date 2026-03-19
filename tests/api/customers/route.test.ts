import { describe, it, expect, vi, beforeEach } from "vitest";
import type { JwtPayload } from "@/lib/types";

// ── db mock ──────────────────────────────────────────────────────────────────
const mockAll = vi.fn(() => []);
const mockCountGet = vi.fn(() => ({ count: 0 }));
const mockInsertRun = vi.fn(() => ({ lastInsertRowid: 42 }));
const mockSelectOneGet = vi.fn();

const mockPrepare = vi.fn((sql: string) => {
  if (sql.includes("COUNT")) return { get: mockCountGet };
  if (sql.includes("INSERT")) return { run: mockInsertRun };
  if (sql.includes("SELECT * FROM customers WHERE id")) return { get: mockSelectOneGet };
  return { all: mockAll };
});
const mockGetDb = vi.fn(() => ({ prepare: mockPrepare }));

vi.mock("@/lib/db", () => ({ getDb: mockGetDb }));

// ── auth mock ────────────────────────────────────────────────────────────────
const mockVerifyToken = vi.fn<() => Promise<JwtPayload | null>>();
const mockGetTokenFromRequest = vi.fn<() => string | null>();

vi.mock("@/lib/auth", () => ({
  verifyToken: mockVerifyToken,
  getTokenFromRequest: mockGetTokenFromRequest,
}));

// ── helpers ──────────────────────────────────────────────────────────────────
function makeGetRequest(url = "http://localhost/api/customers") {
  return new Request(url, { method: "GET" }) as unknown as import("next/server").NextRequest;
}

function makePostRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/customers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

const adminPayload: JwtPayload = { userId: 1, email: "admin@crm.local", name: "Admin", role: "admin" };
const viewerPayload: JwtPayload = { userId: 2, email: "viewer@crm.local", name: "Viewer", role: "viewer" };

const sampleCustomer = {
  id: 42,
  firstName: "Jane",
  lastName: "Doe",
  company: "ACME",
  email: "jane@acme.com",
  phone: "555-1234",
  status: "active",
  lastContact: "2025-01-01",
  createdAt: "2025-01-01T00:00:00",
};

describe("GET /api/customers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with customers for authenticated viewer", async () => {
    mockGetTokenFromRequest.mockReturnValue("token");
    mockVerifyToken.mockResolvedValue(viewerPayload);
    mockAll.mockReturnValue([sampleCustomer]);
    mockCountGet.mockReturnValue({ count: 1 });

    const { GET } = await import("@/app/api/customers/route");
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.customers).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it("returns 401 when no token provided", async () => {
    mockGetTokenFromRequest.mockReturnValue(null);
    mockVerifyToken.mockResolvedValue(null);

    const { GET } = await import("@/app/api/customers/route");
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(401);
  });
});

describe("POST /api/customers", () => {
  const newCustomerBody = {
    firstName: "John",
    lastName: "Smith",
    company: "Corp",
    email: "john@corp.com",
    phone: "555-9999",
    status: "active",
    lastContact: "2025-01-01",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 201 when admin creates a customer", async () => {
    mockGetTokenFromRequest.mockReturnValue("token");
    mockVerifyToken.mockResolvedValue(adminPayload);
    mockSelectOneGet.mockReturnValue({ ...sampleCustomer, id: 42 });

    const { POST } = await import("@/app/api/customers/route");
    const res = await POST(makePostRequest(newCustomerBody));

    expect(res.status).toBe(201);
    expect(mockInsertRun).toHaveBeenCalledOnce();
  });

  it("returns 401 when no token provided", async () => {
    mockGetTokenFromRequest.mockReturnValue(null);
    mockVerifyToken.mockResolvedValue(null);

    const { POST } = await import("@/app/api/customers/route");
    const res = await POST(makePostRequest(newCustomerBody));

    expect(res.status).toBe(401);
  });

  it("returns 403 when viewer tries to create a customer", async () => {
    mockGetTokenFromRequest.mockReturnValue("token");
    mockVerifyToken.mockResolvedValue(viewerPayload);

    const { POST } = await import("@/app/api/customers/route");
    const res = await POST(makePostRequest(newCustomerBody));

    expect(res.status).toBe(403);
  });
});
