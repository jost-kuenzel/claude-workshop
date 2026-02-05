# ACME CRM Workshop

A simple CRM application (ACME CRM) built with Next.js 15, TypeScript, shadcn/ui, and SQLite.

## Getting Started

```bash
npm install
npm run seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Test Users

| Email | Password | Role | Permissions |
|---|---|---|---|
| admin@crm.local | admin123 | admin | View + Edit customers |
| viewer@crm.local | viewer123 | viewer | View only |

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run seed` | Seed database with sample data |
| `npm run lint` | Run ESLint |
| `npm run format` | Run Prettier |

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **UI:** shadcn/ui + Tailwind CSS
- **Database:** SQLite via better-sqlite3
- **Auth:** JWT in httpOnly cookies
