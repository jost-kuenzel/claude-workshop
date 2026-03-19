// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  hashPassword,
  comparePasswords,
  signToken,
  verifyToken,
  getTokenFromRequest,
} from "@/lib/auth";
import type { JwtPayload } from "@/lib/types";

const samplePayload: JwtPayload = {
  userId: 1,
  email: "test@example.com",
  name: "Test User",
  role: "admin",
};

describe("hashPassword", () => {
  it("hashes a password into a bcrypt string", async () => {
    const hash = await hashPassword("secret");
    expect(hash).toMatch(/^\$2[ab]\$/);
  });

  it("produces a different hash each time", async () => {
    const hash1 = await hashPassword("secret");
    const hash2 = await hashPassword("secret");
    expect(hash1).not.toBe(hash2);
  });
});

describe("comparePasswords", () => {
  it("returns true for correct password", async () => {
    const hash = await hashPassword("correct-password");
    const result = await comparePasswords("correct-password", hash);
    expect(result).toBe(true);
  });

  it("returns false for wrong password", async () => {
    const hash = await hashPassword("correct-password");
    const result = await comparePasswords("wrong-password", hash);
    expect(result).toBe(false);
  });
});

describe("signToken / verifyToken", () => {
  it("round-trips a valid token", async () => {
    const token = signToken(samplePayload);
    const payload = await verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe(samplePayload.userId);
    expect(payload!.email).toBe(samplePayload.email);
    expect(payload!.role).toBe(samplePayload.role);
  });

  it("returns null for a tampered token", async () => {
    const token = signToken(samplePayload);
    const tampered = token.slice(0, -5) + "XXXXX";
    const result = await verifyToken(tampered);
    expect(result).toBeNull();
  });

  it("returns null for an empty string", async () => {
    const result = await verifyToken("");
    expect(result).toBeNull();
  });

  it("returns null for a token signed with a different secret", async () => {
    // Create a JWT manually signed with a different secret using jsonwebtoken
    const jwt = await import("jsonwebtoken");
    const badToken = jwt.default.sign(samplePayload, "wrong-secret", { expiresIn: "1h" });
    const result = await verifyToken(badToken);
    expect(result).toBeNull();
  });
});

describe("getTokenFromRequest", () => {
  it("extracts the token value from a crm_token cookie", () => {
    const req = {
      cookies: {
        get: (name: string) =>
          name === "crm_token" ? { value: "my-token-value" } : undefined,
      },
    };
    expect(getTokenFromRequest(req)).toBe("my-token-value");
  });

  it("returns null when the cookie is absent", () => {
    const req = {
      cookies: {
        get: (_: string) => undefined,
      },
    };
    expect(getTokenFromRequest(req)).toBeNull();
  });
});
