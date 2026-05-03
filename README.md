# ACME CRM Workshop

A simple CRM application (ACME CRM) built with Next.js 16, TypeScript, shadcn/ui, and SQLite.

## Prerequisites

This project uses [Bun](https://bun.sh) as both package manager and runtime. Install it with:

```bash
curl -fsSL https://bun.sh/install | bash
```

Bun `>=1.2.0` is required (see `engines.bun` in `package.json`).

## Getting Started

```bash
bun install
bun run seed
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Test Users

| Email            | Password  | Role   | Permissions           |
| ---------------- | --------- | ------ | --------------------- |
| admin@crm.local  | admin123  | admin  | View + Edit customers |
| viewer@crm.local | viewer123 | viewer | View only             |

## Available Scripts

| Script                | Description                    |
| --------------------- | ------------------------------ |
| `bun run dev`         | Start development server       |
| `bun run build`       | Production build               |
| `bun run start`       | Start production server        |
| `bun run seed`        | Seed database with sample data |
| `bun run lint`        | Run ESLint                     |
| `bun run format`      | Run Prettier                   |
| `bun test`            | Run unit tests                 |
| `bun test --watch`    | Run unit tests in watch mode   |
| `bun test --coverage` | Run unit tests with coverage   |

## Supply-chain hardening (minimum release age)

`bunfig.toml` sets `install.minimumReleaseAge = 604800` (7 days). Bun filters
out package versions published more recently than the window during
resolution, so a freshly compromised package can't slip in via a transitive
update. To allow a specific package to bypass the gate (e.g. you intentionally
want the latest release), add it to `minimumReleaseAgeExcludes` in
`bunfig.toml`:

```toml
[install]
minimumReleaseAge = 604800
minimumReleaseAgeExcludes = ["typescript", "@types/node"]
```

The age window can also be overridden ad-hoc via the
`--minimum-release-age=<seconds>` flag on `bun install`.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Runtime / Package manager:** Bun
- **Language:** TypeScript
- **UI:** shadcn/ui + Tailwind CSS
- **Database:** SQLite via better-sqlite3
- **Auth:** JWT in httpOnly cookies
- **Tests:** `bun test` + happy-dom (opt-in) + Testing Library
