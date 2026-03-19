import { describe, it, expect, vi, beforeEach } from "vitest";
import type { JwtPayload } from "@/lib/types";

// ── db mock ──────────────────────────────────────────────────────────────────
const mockAll = vi.fn(() => []);
const mockCountGet = vi.fn(() => ({ count: 0 }));

const mockPrepare = vi.fn((sql: string) => {
  if (sql.includes("COUNT")) return { get: mockCountGet };
  return { all: mockAll };
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

function makeGetRequest(): NextRequest {
  return new Request("http://localhost/api/users") as unknown as NextRequest;
}

const adminPayload: JwtPayload = { userId: 1, email: "admin@crm.local", name: "Admin", role: "admin" };
const viewerPayload: JwtPayload = { userId: 2, email: "viewer@crm.local", name: "Viewer", role: "viewer" };

const sampleUsers = [
  { id: 1, email: "admin@crm.local", name: "Admin", role: "admin" },
  { id: 2, email: "viewer@crm.local", name: "Viewer", role: "viewer" },
];

describe("GET /api/users", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 with users for admin", async () => {
    mockGetTokenFromRequest.mockReturnValue("token");
    mockVerifyToken.mockResolvedValue(adminPayload);
    mockAll.mockReturnValue(sampleUsers);
    mockCountGet.mockReturnValue({ count: 2 });

    const { GET } = await import("@/app/api/users/route");
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.users).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  it("returns 401 when no token provided", async () => {
    mockGetTokenFromRequest.mockReturnValue(null);
    mockVerifyToken.mockResolvedValue(null);

    const { GET } = await import("@/app/api/users/route");
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(401);
  });

  it("returns 403 when viewer tries to list users", async () => {
    mockGetTokenFromRequest.mockReturnValue("token");
    mockVerifyToken.mockResolvedValue(viewerPayload);

    const { GET } = await import("@/app/api/users/route");
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(403);
  });
});
