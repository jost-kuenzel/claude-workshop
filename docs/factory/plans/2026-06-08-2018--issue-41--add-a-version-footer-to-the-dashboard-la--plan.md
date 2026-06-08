---
issue: 41
spec: docs/factory/specs/2026-06-08-1802--issue-41--dashboard-version-footer--design.md
---

# Dashboard Version Footer Implementation Plan

**Goal:** Add a static "ACME CRM v1.0.0" version footer to the dashboard layout so it appears at the bottom of every dashboard page.

**Architecture:** The Next.js app uses a route-group layout at `src/app/(dashboard)/layout.tsx` that wraps all dashboard pages with a sidebar (left) and a main column (right) containing a navbar and a `<main>` content region. The footer is a new presentational React component placed after `<main>` inside that right column; it renders once per page for all dashboard routes and carries no state, props, or data fetching.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Vitest + @testing-library/react for component tests (`.test.tsx` picked up by `bun run test:components`), Bun as package manager and runtime.

## Task Checklist

- [x] Task 1: Create VersionFooter component with direct test
- [ ] Task 2: Integrate VersionFooter into dashboard layout with layout test
- [ ] Task 3: Capture browser screenshot evidence

---

### Task 1: Create VersionFooter component with direct test

**Files:**

- Create: `src/components/VersionFooter.tsx`
- Create: `src/components/__tests__/VersionFooter.test.tsx`

- [ ] Step 1: Write a failing Vitest test in `src/components/__tests__/VersionFooter.test.tsx`:

  ```tsx
  import { render, screen } from "@testing-library/react";
  import VersionFooter from "@/components/VersionFooter";

  describe("VersionFooter", () => {
    it("renders the version string", () => {
      render(<VersionFooter />);
      expect(screen.getByText("ACME CRM v1.0.0")).toBeInTheDocument();
    });
  });
  ```

- [ ] Step 2: Run `bun run test:components` — expect FAIL (module not found).

- [ ] Step 3: Create `src/components/VersionFooter.tsx`:

  ```tsx
  export default function VersionFooter() {
    return (
      <footer className="py-2 text-center text-xs text-muted-foreground">ACME CRM v1.0.0</footer>
    );
  }
  ```

- [ ] Step 4: Run `bun run test:components` — expect PASS.

- [ ] Step 5: Run `bun run lint && bun run typecheck` — expect both clean.

- [ ] Step 6: Commit:

  ```
  git add src/components/VersionFooter.tsx src/components/__tests__/VersionFooter.test.tsx
  git commit -m "feat: add VersionFooter component"
  ```

---

### Task 2: Integrate VersionFooter into dashboard layout with layout test

**Files:**

- Modify: `src/app/(dashboard)/layout.tsx`
- Create: `src/app/(dashboard)/__tests__/layout.test.tsx`

**Context:** `src/components/VersionFooter.tsx` already exists (created by a prior task). It exports a default React component with signature `export default function VersionFooter()` that renders:

```tsx
<footer className="py-2 text-center text-xs text-muted-foreground">ACME CRM v1.0.0</footer>
```

No props, no state, no additional imports.

The current full content of `src/app/(dashboard)/layout.tsx` is:

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

- [ ] Step 1: Create `src/app/(dashboard)/__tests__/layout.test.tsx`. Mock `Sidebar` and `Navbar` because they are complex `"use client"` components that perform `usePathname`, `fetch`, and other browser-only calls that would break in the happy-dom environment. Use `vi.mock` (Vitest's mock — same API as `jest.mock`):

  ```tsx
  import { render, screen } from "@testing-library/react";
  import { vi } from "vitest";

  vi.mock("@/components/Sidebar", () => ({
    default: () => <div data-testid="sidebar" />,
  }));
  vi.mock("@/components/Navbar", () => ({
    default: () => <div data-testid="navbar" />,
  }));

  import DashboardLayout from "../layout";

  describe("DashboardLayout", () => {
    it("renders the version footer", () => {
      render(
        <DashboardLayout>
          <div>content</div>
        </DashboardLayout>
      );
      expect(screen.getByText("ACME CRM v1.0.0")).toBeInTheDocument();
    });
  });
  ```

- [ ] Step 2: Run `bun run test:components` — expect FAIL (footer text not found in the current layout).

- [ ] Step 3: Edit `src/app/(dashboard)/layout.tsx` to import `VersionFooter` and place it after `<main>`:

  ```tsx
  import Sidebar from "@/components/Sidebar";
  import Navbar from "@/components/Navbar";
  import VersionFooter from "@/components/VersionFooter";

  export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <Navbar />
          <main className="flex-1 p-6">{children}</main>
          <VersionFooter />
        </div>
      </div>
    );
  }
  ```

- [ ] Step 4: Run `bun run test:components` — expect PASS.

- [ ] Step 5: Run the full test suite: `bun run test` — expect all tests (unit + component) pass.

- [ ] Step 6: Run `bun run lint && bun run typecheck` — expect both clean.

- [ ] Step 7: Self-verify in browser via the `frontend-verify` skill — start `bun run dev`, navigate to `http://localhost:3000/login`, sign in with `admin@crm.local` / `admin123`, navigate to `http://localhost:3000/dashboard`, confirm "ACME CRM v1.0.0" appears at the bottom of the layout below the page content, and check for no same-origin console errors.

- [ ] Step 8: Commit:

  ```
  git add src/app/(dashboard)/layout.tsx src/app/(dashboard)/__tests__/layout.test.tsx
  git commit -m "feat: integrate VersionFooter into dashboard layout"
  ```

---

### Task 3: Capture browser screenshot evidence

This is evidence capture, not test-first: produce the screenshot artifact.

**Files:**

- Create: `docs/factory/evidence/issue-41/dashboard-version-footer.png`

The app is a Next.js project. `bun run dev` starts the dev server at `http://localhost:3000`. Sign in at `/login` with `admin@crm.local` / `admin123`; the dashboard is at `/dashboard`.

- [ ] Step 1: Create the evidence directory:

  ```
  mkdir -p docs/factory/evidence/issue-41
  ```

- [ ] Step 2: Start the dev server in the background and wait for it to be ready:

  ```
  bun run dev &
  sleep 5
  ```

- [ ] Step 3: Use the `playwright-cli` skill to:
  1. Navigate to `http://localhost:3000/login`
  2. Fill in email `admin@crm.local` and password `admin123` and submit
  3. Wait for navigation to `/dashboard`
  4. Run:
     ```
     playwright-cli screenshot --filename=docs/factory/evidence/issue-41/dashboard-version-footer.png
     ```
  5. Confirm "ACME CRM v1.0.0" is visible at the bottom of the screenshot

- [ ] Step 4: Stop the dev server (kill the background process).

- [ ] Step 5: Commit the screenshot:

  ```
  git add docs/factory/evidence/issue-41/dashboard-version-footer.png
  git commit -m "evidence: dashboard version footer screenshot for issue 41"
  ```
