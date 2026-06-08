---
issue: 41
spec: docs/factory/specs/2026-06-08-1802--issue-41--dashboard-version-footer--design.md
---

# Dashboard Version Footer Implementation Plan

**Goal:** Add a static "ACME CRM v1.0.0" footer to the dashboard layout so it appears at the bottom of every dashboard page.

**Architecture:** The dashboard layout (`src/app/(dashboard)/layout.tsx`) wraps every dashboard route (dashboard, customers, users) in a shared column that includes a Sidebar, Navbar, and `<main>` content region. The footer is a new `<footer>` element added after `<main>` in that column — one JSX change, no state or props. The component test renders the layout directly with both sibling components mocked (they use client-side hooks incompatible with the test environment) and asserts the footer text is present.

**Tech Stack:** Next.js 14 App Router, React 18, Tailwind CSS, Vitest + `@testing-library/react` + `@testing-library/jest-dom` for component tests (`.test.tsx` files run with `bun run test:components`), Playwright CLI for screenshot capture.

## Task Checklist

- [ ] Task 1: Add footer to dashboard layout with component test
- [ ] Task 2: Capture screenshot evidence

---

### Task 1: Add footer to dashboard layout with component test

**Files:**

- Modify: `src/app/(dashboard)/layout.tsx`
- Create: `src/app/(dashboard)/__tests__/layout.test.tsx`

- [ ] Step 1: Create the test file `src/app/(dashboard)/__tests__/layout.test.tsx` with this content (the test will fail because the footer does not exist yet):

  ```tsx
  import { vi } from "vitest";
  import { render, screen } from "@testing-library/react";
  import DashboardLayout from "@/app/(dashboard)/layout";

  vi.mock("@/components/Sidebar", () => ({
    default: () => <div data-testid="sidebar" />,
  }));

  vi.mock("@/components/Navbar", () => ({
    default: () => <div data-testid="navbar" />,
  }));

  describe("DashboardLayout", () => {
    it("renders the version footer", () => {
      render(
        <DashboardLayout>
          <p>page content</p>
        </DashboardLayout>
      );
      expect(screen.getByText("ACME CRM v1.0.0")).toBeInTheDocument();
    });

    it("renders children inside the layout", () => {
      render(
        <DashboardLayout>
          <p>hello world</p>
        </DashboardLayout>
      );
      expect(screen.getByText("hello world")).toBeInTheDocument();
    });
  });
  ```

- [ ] Step 2: Run `bun run test:components` — expect **FAIL** (no footer element yet, `getByText("ACME CRM v1.0.0")` throws `Unable to find an element`).

- [ ] Step 3: Open `src/app/(dashboard)/layout.tsx`. Its current content is:

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

  Replace it with:

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
          <footer className="py-2 text-center text-xs text-muted-foreground">
            ACME CRM v1.0.0
          </footer>
        </div>
      </div>
    );
  }
  ```

- [ ] Step 4: Run `bun run test:components` — expect **PASS** (both footer and children tests pass).

- [ ] Step 5: Run the full suite to confirm nothing is broken:

  ```
  bun run test && bun run lint && bun run typecheck
  ```

  All must exit 0.

- [ ] Step 6: Self-verify in the browser using the `frontend-verify` skill. Start the dev server (`bun run dev`, http://localhost:3000), sign in, navigate to `/dashboard`, and confirm:
  - A small muted line "ACME CRM v1.0.0" appears at the bottom of the layout below the page content.
  - It does not overlap any page content.
  - No same-origin console errors.
  - Repeat on `/customers` and `/users` to confirm it is present on every dashboard route.

- [ ] Step 7: Commit:
  ```
  git add "src/app/(dashboard)/layout.tsx" "src/app/(dashboard)/__tests__/layout.test.tsx"
  git commit -m "feat: add ACME CRM v1.0.0 footer to dashboard layout"
  ```

---

### Task 2: Capture screenshot evidence

This task is evidence capture, not test-first: produce the screenshot artifact.

**Files:**

- Create: `docs/factory/evidence/issue-41/version-footer.png` (screenshot artifact)

- [ ] Step 1: Start the dev server if it is not already running:

  ```
  bun run dev
  ```

  Wait until `http://localhost:3000` is ready.

- [ ] Step 2: Use the `playwright-cli` skill to sign in and navigate to `/dashboard`.

- [ ] Step 3: Capture the screenshot (create the directory first):

  ```
  mkdir -p docs/factory/evidence/issue-41
  ```

  Then via playwright-cli:

  ```
  playwright-cli screenshot --filename=docs/factory/evidence/issue-41/version-footer.png
  ```

  The screenshot must show the full dashboard page with "ACME CRM v1.0.0" visible at the bottom.

- [ ] Step 4: Stage and commit the screenshot:

  ```
  git add docs/factory/evidence/issue-41/version-footer.png
  git commit -m "evidence: screenshot for issue 41 version footer"
  ```

- [ ] Step 5: Stop the dev server.
