import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import type { User } from "@/lib/types";

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req);
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (payload.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.max(1, parseInt(url.searchParams.get("limit") || "10", 10));
  const offset = (page - 1) * limit;

  const db = getDb();
  const total = (db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number })
    .count;
  const users = db
    .prepare("SELECT id, email, name, role FROM users ORDER BY id ASC LIMIT ? OFFSET ?")
    .all(limit, offset) as Omit<User, "password">[];

  return NextResponse.json({ users, total, page, limit });
}
