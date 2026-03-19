import { describe, it, expect, vi, beforeEach } from "vitest";

// ── db mock ─────────────────────────────────────────────────────────────────
const mockGet = vi.fn();
const mockPrepare = vi.fn(() => ({ get: mockGet }));
const mockGetDb = vi.fn(() => ({ prepare: mockPrepare }));

vi.mock("@/lib/db", () => ({ getDb: mockGetDb }));

// ── auth mock ────────────────────────────────────────────────────────────────
const mockComparePasswords = vi.fn();
const mockSignToken = vi.fn(() => "fake-token");
const mockSetAuthCookie = vi.fn();

vi.mock("@/lib/auth", () => ({
  comparePasswords: mockComparePasswords,
  signToken: mockSignToken,
  setAuthCookie: mockSetAuthCookie,
}));

// ── helpers ──────────────────────────────────────────────────────────────────
function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const fakeUser = {
  id: 1,
  email: "admin@crm.local",
  password: "$hashed",
  name: "Admin",
  role: "admin" as const,
};

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with message on valid credentials", async () => {
    mockGet.mockReturnValue(fakeUser);
    mockComparePasswords.mockResolvedValue(true);

    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeRequest({ email: "admin@crm.local", password: "admin123" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Logged in");
    expect(mockSetAuthCookie).toHaveBeenCalledOnce();
  });

  it("returns 400 when email is missing", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeRequest({ password: "admin123" }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("returns 400 when password is missing", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeRequest({ email: "admin@crm.local" }));

    expect(res.status).toBe(400);
  });

  it("returns 401 when user is not found", async () => {
    mockGet.mockReturnValue(undefined);

    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeRequest({ email: "unknown@crm.local", password: "whatever" }));

    expect(res.status).toBe(401);
  });

  it("returns 401 when password is wrong", async () => {
    mockGet.mockReturnValue(fakeUser);
    mockComparePasswords.mockResolvedValue(false);

    const { POST } = await import("@/app/api/auth/login/route");
    const res = await POST(makeRequest({ email: "admin@crm.local", password: "wrong" }));

    expect(res.status).toBe(401);
  });
});
