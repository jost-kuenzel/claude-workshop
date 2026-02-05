import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";
import fs from "fs";

const DB_PATH = path.resolve(process.cwd(), "data", "crm.db");

// Ensure data directory exists
fs.mkdirSync(path.resolve(process.cwd(), "data"), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

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

// Clear existing data
db.exec("DELETE FROM customers; DELETE FROM users;");

// Seed users
const users = [
  { email: "admin@crm.local", password: "admin123", name: "Alice Admin", role: "admin" },
  { email: "viewer@crm.local", password: "viewer123", name: "Victor Viewer", role: "viewer" },
];

const insertUser = db.prepare(
  "INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)"
);

for (const user of users) {
  const hashed = bcrypt.hashSync(user.password, 10);
  insertUser.run(user.email, hashed, user.name, user.role);
}

// Seed customers
const customers = [
  {
    firstName: "John",
    lastName: "Smith",
    company: "Acme Corp",
    email: "john@acme.com",
    phone: "+1-555-0101",
    status: "active",
    lastContact: "2025-01-15",
  },
  {
    firstName: "Sarah",
    lastName: "Johnson",
    company: "TechStart Inc",
    email: "sarah@techstart.io",
    phone: "+1-555-0102",
    status: "active",
    lastContact: "2025-01-20",
  },
  {
    firstName: "Michael",
    lastName: "Brown",
    company: "Global Services",
    email: "m.brown@globalserv.com",
    phone: "+1-555-0103",
    status: "inactive",
    lastContact: "2024-11-30",
  },
  {
    firstName: "Emma",
    lastName: "Davis",
    company: "Design Studio",
    email: "emma@designstudio.co",
    phone: "+1-555-0104",
    status: "active",
    lastContact: "2025-01-22",
  },
  {
    firstName: "James",
    lastName: "Wilson",
    company: "Finance Plus",
    email: "jwilson@financeplus.com",
    phone: "+1-555-0105",
    status: "active",
    lastContact: "2025-01-10",
  },
  {
    firstName: "Lisa",
    lastName: "Anderson",
    company: "Marketing Pro",
    email: "lisa@marketingpro.net",
    phone: "+1-555-0106",
    status: "inactive",
    lastContact: "2024-12-05",
  },
  {
    firstName: "Robert",
    lastName: "Taylor",
    company: "Cloud Nine",
    email: "robert@cloudnine.io",
    phone: "+1-555-0107",
    status: "active",
    lastContact: "2025-01-18",
  },
  {
    firstName: "Jennifer",
    lastName: "Martinez",
    company: "Data Dynamics",
    email: "jmartinez@datadyn.com",
    phone: "+1-555-0108",
    status: "active",
    lastContact: "2025-01-21",
  },
  {
    firstName: "William",
    lastName: "Garcia",
    company: "Web Solutions",
    email: "wgarcia@websol.net",
    phone: "+1-555-0109",
    status: "inactive",
    lastContact: "2024-10-15",
  },
  {
    firstName: "Amanda",
    lastName: "Rodriguez",
    company: "Smart Systems",
    email: "amanda@smartsys.com",
    phone: "+1-555-0110",
    status: "active",
    lastContact: "2025-01-19",
  },
  {
    firstName: "David",
    lastName: "Lee",
    company: "Innovation Labs",
    email: "dlee@innolabs.io",
    phone: "+1-555-0111",
    status: "active",
    lastContact: "2025-01-23",
  },
  {
    firstName: "Michelle",
    lastName: "White",
    company: "Digital First",
    email: "mwhite@digitalfirst.com",
    phone: "+1-555-0112",
    status: "inactive",
    lastContact: "2024-09-20",
  },
  {
    firstName: "Christopher",
    lastName: "Harris",
    company: "Tech Pioneers",
    email: "charris@techpioneers.net",
    phone: "+1-555-0113",
    status: "active",
    lastContact: "2025-01-17",
  },
  {
    firstName: "Jessica",
    lastName: "Clark",
    company: "Creative Agency",
    email: "jclark@creativeagency.co",
    phone: "+1-555-0114",
    status: "active",
    lastContact: "2025-01-24",
  },
  {
    firstName: "Daniel",
    lastName: "Lewis",
    company: "Enterprise Co",
    email: "dlewis@enterpriseco.com",
    phone: "+1-555-0115",
    status: "inactive",
    lastContact: "2024-12-10",
  },
  {
    firstName: "Nicole",
    lastName: "Walker",
    company: "Startup Hub",
    email: "nwalker@startuphub.io",
    phone: "+1-555-0116",
    status: "active",
    lastContact: "2025-01-25",
  },
];

const insertCustomer = db.prepare(
  "INSERT INTO customers (firstName, lastName, company, email, phone, status, lastContact) VALUES (?, ?, ?, ?, ?, ?, ?)"
);

for (const c of customers) {
  insertCustomer.run(c.firstName, c.lastName, c.company, c.email, c.phone, c.status, c.lastContact);
}

console.log(`Seeded ${users.length} users and ${customers.length} customers.`);

db.close();
