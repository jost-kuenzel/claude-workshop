import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import type { Customer } from "@/lib/types";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = getTokenFromRequest(req);
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const db = getDb();
  const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(Number(id)) as
    | Customer
    | undefined;

  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(customer);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = getTokenFromRequest(req);
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (payload.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { firstName, lastName, company, email, phone, status, lastContact } = await req.json();

  const db = getDb();
  db.prepare(
    "UPDATE customers SET firstName=?, lastName=?, company=?, email=?, phone=?, status=?, lastContact=? WHERE id=?"
  ).run(firstName, lastName, company, email, phone, status, lastContact, Number(id));

  const customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(Number(id)) as Customer;
  return NextResponse.json(customer);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = getTokenFromRequest(req);
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (payload.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM customers WHERE id = ?").run(Number(id));

  return NextResponse.json({ message: "Deleted" });
}
