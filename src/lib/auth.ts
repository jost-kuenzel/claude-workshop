import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { type NextResponse } from "next/server";
import * as jose from "jose";
import type { JwtPayload } from "@/lib/types";

const JWT_SECRET = process.env.JWT_SECRET || "crm-workshop-secret-key";
const SECRET = new TextEncoder().encode(JWT_SECRET);
const COOKIE_NAME = "crm_token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePasswords(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const verified = await jose.jwtVerify(token, SECRET);
    const payload = verified.payload as unknown as JwtPayload;
    return payload;
  } catch {
    return null;
  }
}

export function setAuthCookie(res: NextResponse, token: string): void {
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export function clearAuthCookie(res: NextResponse): void {
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

export function getTokenFromRequest(req: {
  cookies: { get: (name: string) => { value: string } | undefined };
}): string | null {
  const cookie = req.cookies.get(COOKIE_NAME);
  return cookie?.value || null;
}
