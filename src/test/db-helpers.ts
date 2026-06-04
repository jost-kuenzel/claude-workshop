import { Database } from "bun:sqlite";
import { hashPassword } from "@/lib/auth";

export function createTestDb() {
  const db = new Database(":memory:");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'viewer'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      company TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      lastContact TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return db;
}

export async function seedUser(
  db: Database,
  overrides: Partial<{
    id?: number;
    email: string;
    password: string;
    name: string;
    role: "admin" | "viewer";
  }> = {}
) {
  const user = {
    email: "admin@example.com",
    password: "password123",
    name: "Admin User",
    role: "admin" as const,
    ...overrides,
  };

  const hashedPassword = await hashPassword(user.password);

  const stmt = db.prepare(`
    INSERT INTO users (email, password, name, role)
    VALUES ($email, $password, $name, $role)
  `);

  return stmt.run({
    $email: user.email,
    $password: hashedPassword,
    $name: user.name,
    $role: user.role,
  });
}

export async function seedCustomer(
  db: Database,
  overrides: Partial<{
    id?: number;
    firstName: string;
    lastName: string;
    company: string;
    email: string;
    phone: string;
    status: "active" | "inactive";
    lastContact: string;
    createdAt: string;
  }> = {}
) {
  const customer = {
    firstName: "John",
    lastName: "Doe",
    company: "Acme Corp",
    email: "john@example.com",
    phone: "1234567890",
    status: "active" as const,
    lastContact: "2024-01-01",
    createdAt: "2024-01-01 00:00:00",
    ...overrides,
  };

  const stmt = db.prepare(`
    INSERT INTO customers (firstName, lastName, company, email, phone, status, lastContact, createdAt)
    VALUES ($firstName, $lastName, $company, $email, $phone, $status, $lastContact, $createdAt)
  `);

  return stmt.run({
    $firstName: customer.firstName,
    $lastName: customer.lastName,
    $company: customer.company,
    $email: customer.email,
    $phone: customer.phone,
    $status: customer.status,
    $lastContact: customer.lastContact,
    $createdAt: customer.createdAt,
  });
}
