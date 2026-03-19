import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  usePathname: vi.fn(() => "/customers"),
}));

// Mock Next.js Link to avoid router context issues
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const sampleCustomers = [
  {
    id: 1,
    firstName: "Jane",
    lastName: "Doe",
    company: "ACME",
    email: "jane@acme.com",
    phone: "555-1234",
    status: "active",
    lastContact: "2025-01-01",
    createdAt: "2025-01-01T00:00:00",
  },
  {
    id: 2,
    firstName: "John",
    lastName: "Smith",
    company: "Corp",
    email: "john@corp.com",
    phone: "555-9999",
    status: "inactive",
    lastContact: "2025-02-01",
    createdAt: "2025-02-01T00:00:00",
  },
];

describe("CustomerList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", async () => {
    // Fetch never resolves so loading remains true
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {}))
    );

    const CustomerList = (await import("@/app/(dashboard)/customers/_components/CustomerList")).default;
    render(<CustomerList />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("renders customer table after successful fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ customers: sampleCustomers, total: 2, page: 1, limit: 10 }),
        })
      )
    );

    const CustomerList = (await import("@/app/(dashboard)/customers/_components/CustomerList")).default;
    render(<CustomerList />);

    await waitFor(() => {
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
      expect(screen.getByText("John Smith")).toBeInTheDocument();
    });

    expect(screen.getByText("ACME")).toBeInTheDocument();
    expect(screen.getByText("Corp")).toBeInTheDocument();
  });

  it("renders column headers in the table", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ customers: [], total: 0, page: 1, limit: 10 }),
        })
      )
    );

    const CustomerList = (await import("@/app/(dashboard)/customers/_components/CustomerList")).default;
    render(<CustomerList />);

    await waitFor(() => {
      expect(screen.getByText(/name/i)).toBeInTheDocument();
      expect(screen.getByText(/company/i)).toBeInTheDocument();
      expect(screen.getByText(/email/i)).toBeInTheDocument();
    });
  });
});
