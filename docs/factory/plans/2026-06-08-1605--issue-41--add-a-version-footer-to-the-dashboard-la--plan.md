---
issue: 41
spec: docs/factory/specs/2026-06-08-1802--issue-41--dashboard-version-footer--design.md
---

# Dashboard Version Footer Implementation Plan

**Goal:** Add a static "ACME CRM v1.0.0" version footer to the shared dashboard layout so it appears at the bottom of every dashboard page.

**Architecture:** The app is a Next.js 15 App Router project. All dashboard pages (`/dashboard`, `/customers`, `/users`) are wrapped by `src/app/(dashboard)/layout.tsx`, which renders a Sidebar, a Navbar, and a `<main>` content region inside a flex column. The footer is one new `<footer>` element placed after `<main>` in that same flex column — it renders once, shared across every dashboard route, and never overlaps content because `<main>` has `flex-1` (grows to fill remaining space).

**Tech Stack:** Next.js 15 (App Router), React, Tailwind CSS utility classes, Vitest + React Testing Library (`@testing-library/react`) for component tests, Bun as the runtime and test runner.

## Task Checklist

- [x] Task 1: Add version footer to dashboard layout (TDD)
- [ ] Task 2: Capture screenshot evidence

---

### Task 1: Add version footer to dashboard layout (TDD)

**Files:**

- Modify: `src/app/(dashboard)/layout.tsx`
- Create: `src/app/(dashboard)/__tests__/layout.test.tsx`

- [ ] Step 1: Create directory `src/app/(dashboard)/__tests__/` if it does not already exist, then create `src/app/(dashboard)/__tests__/layout.test.tsx` with this exact content:

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
        <div>page content</div>
      </DashboardLayout>
    );
    expect(screen.getByText("ACME CRM v1.0.0")).toBeInTheDocument();
  });
});
```

The test mocks `Sidebar` and `Navbar` to avoid their client-side effects (fetch calls, `usePathname`). It renders `DashboardLayout` with a dummy child and asserts the footer text is present in the document.

- [ ] Step 2: Run the test and confirm it **fails** (the footer element does not exist yet):

```bash
bunx vitest run "src/app/(dashboard)/__tests__/layout.test.tsx"
```

Expected output: `FAIL` with an error like `Unable to find an element with the text: ACME CRM v1.0.0`.

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

Replace the entire file with:

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
        <footer className="border-t py-3 text-center text-xs text-gray-400">ACME CRM v1.0.0</footer>
      </div>
    </div>
  );
}
```

The `<footer>` sits after `<main>` in the flex column. Because `<main>` has `flex-1`, it grows to consume all remaining vertical space; the footer is pushed to the bottom and never overlaps content.

- [ ] Step 4: Run the test again and confirm it **passes**:

```bash
bunx vitest run "src/app/(dashboard)/__tests__/layout.test.tsx"
```

Expected output: `PASS` — 1 test passed.

- [ ] Step 5: Run the full suite plus lint and type-check to confirm nothing is broken:

```bash
bun run test && bun run lint && bun run typecheck
```

All three commands must exit 0.

- [ ] Step 6: Self-verify in browser via the `frontend-verify` skill — start `bun run dev` (http://localhost:3000), sign in, navigate to `/dashboard`, and confirm "ACME CRM v1.0.0" appears at the very bottom of the layout below the page content with no same-origin console errors. Also check `/customers` and `/users` to confirm the footer appears on every dashboard route.

- [ ] Step 7: Commit both files:

```bash
git add src/app/\(dashboard\)/layout.tsx src/app/\(dashboard\)/__tests__/layout.test.tsx
git commit -m "feat: add version footer to dashboard layout"
```

---

### Task 2: Capture screenshot evidence

**Note: evidence capture, not test-first** — the goal is to produce a committed screenshot artifact showing the footer rendered in a real browser. No failing test to write first; "screenshot produced + committed" is the acceptance criterion.

**Files:**

- Create: `docs/factory/evidence/issue-41/dashboard-version-footer.png`

- [ ] Step 1: Create the evidence directory:

```bash
mkdir -p docs/factory/evidence/issue-41
```

- [ ] Step 2: Start the dev server in the background:

```bash
bun run dev &
```

Wait for it to print `Ready on http://localhost:3000` (a few seconds).

- [ ] Step 3: Use the `playwright-cli` skill to:
  1. Navigate to `http://localhost:3000` — if redirected to `/login`, sign in with the app's test credentials (email and password fields are labeled "Email" and "Password" on the login form).
  2. Navigate to `http://localhost:3000/dashboard`.
  3. Capture the screenshot to the tracked path:

```bash
playwright-cli screenshot --url http://localhost:3000/dashboard --filename docs/factory/evidence/issue-41/dashboard-version-footer.png
```

The screenshot must show the "ACME CRM v1.0.0" footer text at the bottom of the page.

- [ ] Step 4: Stop the dev server (kill the background process started in Step 2).

- [ ] Step 5: Commit the screenshot:

```bash
git add docs/factory/evidence/issue-41/dashboard-version-footer.png
git commit -m "evidence: screenshot of version footer for issue 41"
```
