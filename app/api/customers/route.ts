import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import type { Customer } from "@/lib/types";

export async function GET(req: NextRequest) {
  const token = getTokenFromRequest(req);
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.max(1, parseInt(url.searchParams.get("limit") || "10", 10));
  const offset = (page - 1) * limit;

  const db = getDb();
  const total = (db.prepare("SELECT COUNT(*) as count FROM customers").get() as { count: number })
    .count;
  const customers = db
    .prepare("SELECT * FROM customers ORDER BY createdAt DESC LIMIT ? OFFSET ?")
    .all(limit, offset) as Customer[];

  return NextResponse.json({ customers, total, page, limit });
}

export async function POST(req: NextRequest) {
  const token = getTokenFromRequest(req);
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (payload.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { firstName, lastName, company, email, phone, status, lastContact } = await req.json();

  const db = getDb();
  const result = db
    .prepare(
      "INSERT INTO customers (firstName, lastName, company, email, phone, status, lastContact) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(firstName, lastName, company, email, phone, status, lastContact);

  const customer = db
    .prepare("SELECT * FROM customers WHERE id = ?")
    .get(result.lastInsertRowid) as Customer;
  return NextResponse.json(customer, { status: 201 });
}
