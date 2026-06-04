import { describe, it, expect } from "bun:test";
import { middleware } from "@/middleware";
import { NextResponse } from "next/server";
import { signToken } from "@/lib/auth";

describe("middleware", () => {
  const createMockRequest = (path: string, token: string | null = null) => {
    const url = new URL(`http://localhost${path}`);
    // Mock cookies
    const mockRequest = {
      nextUrl: url,
      url: url.toString(),
      cookies: {
        get: (name: string) => {
          if (name === "crm_token" && token) {
            return { value: token };
          }
          return undefined;
        },
      },
    } as unknown as Parameters<typeof middleware>[0];

    return mockRequest;
  };

  describe("unauthenticated user", () => {
    it("should redirect /customers to /login", async () => {
      const request = createMockRequest("/customers");
      const response = await middleware(request);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost/login");
    });

    it("should redirect /users to /login", async () => {
      const request = createMockRequest("/users");
      const response = await middleware(request);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost/login");
    });

    it("should redirect /dashboard to /login", async () => {
      const request = createMockRequest("/dashboard");
      const response = await middleware(request);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost/login");
    });
  });

  describe("authenticated user", () => {
    const token = signToken({
      userId: 1,
      email: "test@example.com",
      name: "Test User",
      role: "admin",
    });

    it("should allow /customers through", async () => {
      const request = createMockRequest("/customers", token);
      const response = await middleware(request);

      expect(response).toBeInstanceOf(NextResponse);
      // Should not redirect
      expect(response.status).not.toBe(307);
    });

    it("should redirect /login to /dashboard", async () => {
      const request = createMockRequest("/login", token);
      const response = await middleware(request);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost/dashboard");
    });
  });
});
