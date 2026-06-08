---
issue: 41
spec: docs/factory/specs/2026-06-08-1802--issue-41--dashboard-version-footer--design.md
---

# Dashboard Version Footer Implementation Plan

**Goal:** Add a static "ACME CRM v1.0.0" version footer to the shared dashboard layout so it appears at the bottom of every dashboard page.

**Architecture:** The Next.js app uses a route-group layout at `src/app/(dashboard)/layout.tsx` that wraps every dashboard page (dashboard, customers, users) with a sidebar, navbar, and `<main>` content area. The footer is a new `<footer>` element placed after `<main>` inside the existing flex column, using Tailwind utility classes to keep it small and muted. No props, state, or data fetching — purely presentational.

**Tech Stack:** Next.js 14 (App Router), React, Tailwind CSS, Vitest + React Testing Library (`bun run test:components` for `*.test.tsx` files), `@testing-library/react` and `screen` for component assertions.

## Task Checklist

- [ ] Task 1: Add footer to dashboard layout with component test
- [ ] Task 2: Screenshot evidence capture

---

### Task 1: Add footer to dashboard layout with component test

**Files:**

- Modify: `src/app/(dashboard)/layout.tsx`
- Create: `src/app/(dashboard)/__tests__/layout.test.tsx`

**Context for this task:** The dashboard layout lives at `src/app/(dashboard)/layout.tsx`. It currently renders a `<div>` with a sidebar on the left and a flex column (`flex flex-1 flex-col`) containing a `<Navbar />` and a `<main>` on the right. You will add a `<footer>` element after `<main>` inside that column, then write a Vitest component test (`*.test.tsx`) that asserts the footer text is rendered. Component tests use `bun run test:components` (Vitest + happy-dom). Do **not** add `GlobalRegistrator.register()` or `afterEach(cleanup)` — Vitest handles that automatically.

- [ ] Step 1: Write the failing test

  Create `src/app/(dashboard)/__tests__/layout.test.tsx` with this content:

  ```tsx
  import { render, screen } from "@testing-library/react";
  import DashboardLayout from "@/app/(dashboard)/layout";

  // Stub child components so the test stays fast and isolated
  vi.mock("@/components/Sidebar", () => ({
    default: () => <aside data-testid="sidebar" />,
  }));
  vi.mock("@/components/Navbar", () => ({
    default: () => <nav data-testid="navbar" />,
  }));

  describe("DashboardLayout — version footer", () => {
    it("renders the version footer text on every dashboard page", () => {
      render(
        <DashboardLayout>
          <div>page content</div>
        </DashboardLayout>
      );
      expect(screen.getByText("ACME CRM v1.0.0")).toBeInTheDocument();
    });
  });
  ```

- [ ] Step 2: Run the test and confirm it fails

  ```bash
  bun run test:components
  ```

  Expected output: one failing test — `renders the version footer text on every dashboard page`.

- [ ] Step 3: Add the footer to the layout

  Open `src/app/(dashboard)/layout.tsx`. The current file reads:

  ```tsx
  import Sidebar from "@/components/Sidebar";
  import Navbar from "@/components/Navbar";

  export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <Navbar />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    );
  }
  ```

  Replace the inner column (`<div className="flex flex-1 flex-col">`) block so it becomes:

  ```tsx
  import Sidebar from "@/components/Sidebar";
  import Navbar from "@/components/Navbar";

  export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <Navbar />
          <main className="flex-1 p-6">{children}</main>
          <footer className="py-3 text-center text-xs text-muted-foreground">
            ACME CRM v1.0.0
          </footer>
        </div>
      </div>
    );
  }
  ```

- [ ] Step 4: Run the test and confirm it passes

  ```bash
  bun run test:components
  ```

  Expected: all tests pass, including the new layout test.

- [ ] Step 5: Run the full suite and static checks

  ```bash
  bun run test && bun run lint && bun run typecheck
  ```

  All must exit 0.

- [ ] Step 6: Self-verify in browser via the `frontend-verify` skill — drive Chromium to `http://localhost:3000/dashboard` and confirm the footer "ACME CRM v1.0.0" is visible at the bottom of the layout with no same-origin console errors.

- [ ] Step 7: Commit

  ```bash
  git add src/app/(dashboard)/layout.tsx src/app/(dashboard)/__tests__/layout.test.tsx
  git commit -m "feat: add version footer to dashboard layout"
  ```

---

### Task 2: Screenshot evidence capture

**Files:**

- Create: `docs/factory/evidence/issue-41/dashboard-version-footer.png`

**Context for this task:** This is evidence capture, not test-first — produce the screenshot artifact. The dashboard layout at `src/app/(dashboard)/layout.tsx` now renders a static footer reading "ACME CRM v1.0.0" at the bottom of every page. You need to start the dev server, navigate to the dashboard page (sign in first), take a screenshot showing the footer, commit it, then stop the server.

The app runs on `http://localhost:3000`. Default login credentials: email `admin@example.com`, password `password` (or use the seeded credentials from the repo's seed script — try `admin@example.com` / `password` first). After sign-in you will be redirected to `/dashboard`.

- [ ] Step 1: Ensure the evidence directory exists

  ```bash
  mkdir -p docs/factory/evidence/issue-41
  ```

- [ ] Step 2: Start the dev server in the background

  ```bash
  bun run dev &
  ```

  Wait ~5 seconds for it to be ready (or poll `http://localhost:3000` until it responds).

- [ ] Step 3: Sign in and capture the screenshot

  Use the `playwright-cli` skill to:
  1. Navigate to `http://localhost:3000/login`
  2. Fill in email `admin@example.com` and password `password`, submit
  3. Wait for navigation to `/dashboard`
  4. Take a screenshot:
     ```
     playwright-cli screenshot --filename=docs/factory/evidence/issue-41/dashboard-version-footer.png
     ```

  Confirm the screenshot file exists and the footer text "ACME CRM v1.0.0" is visible at the bottom of the viewport.

- [ ] Step 4: Stop the dev server

  ```bash
  pkill -f "bun run dev" || true
  ```

- [ ] Step 5: Commit the screenshot

  ```bash
  git add docs/factory/evidence/issue-41/dashboard-version-footer.png
  git commit -m "evidence: dashboard version footer screenshot for issue 41"
  ```
