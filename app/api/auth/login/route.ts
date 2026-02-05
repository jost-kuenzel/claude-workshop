import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { comparePasswords, signToken, setAuthCookie } from "@/lib/auth";
import type { User } from "@/lib/types";

export async function POST(req: Request) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const db = getDb();
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as User | undefined;

  if (!user || !(await comparePasswords(password, user.password))) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = signToken({ userId: user.id, email: user.email, name: user.name, role: user.role });

  const res = NextResponse.json({ message: "Logged in" });
  setAuthCookie(res, token);
  return res;
}
