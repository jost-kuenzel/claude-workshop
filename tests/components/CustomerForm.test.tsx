import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Customer } from "@/lib/types";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  usePathname: vi.fn(() => "/customers"),
}));

// Stub global fetch so the form can call it without a server
vi.stubGlobal("fetch", vi.fn());

const sampleCustomer: Customer = {
  id: 1,
  firstName: "Jane",
  lastName: "Doe",
  company: "ACME",
  email: "jane@acme.com",
  phone: "555-1234",
  status: "active",
  lastContact: "2025-01-01",
  createdAt: "2025-01-01T00:00:00",
};

describe("CustomerForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders in create mode (no customer prop)", async () => {
    const CustomerForm = (await import("@/app/(dashboard)/customers/_components/CustomerForm")).default;
    render(<CustomerForm />);

    // Should render form fields
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/company/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();

    // Submit button says "Create"
    expect(screen.getByRole("button", { name: /create/i })).toBeInTheDocument();

    // No Delete button in create mode
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("renders in edit mode with customer data", async () => {
    const CustomerForm = (await import("@/app/(dashboard)/customers/_components/CustomerForm")).default;
    render(<CustomerForm customer={sampleCustomer} />);

    // Fields are pre-filled
    expect(screen.getByDisplayValue("Jane")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Doe")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ACME")).toBeInTheDocument();

    // Submit button says "Update"
    expect(screen.getByRole("button", { name: /update/i })).toBeInTheDocument();

    // Delete button present in edit mode
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("renders in readOnly mode with no action buttons", async () => {
    const CustomerForm = (await import("@/app/(dashboard)/customers/_components/CustomerForm")).default;
    render(<CustomerForm customer={sampleCustomer} readOnly />);

    // Fields are disabled
    const firstNameInput = screen.getByDisplayValue("Jane");
    expect(firstNameInput).toBeDisabled();

    // No submit or delete buttons in readOnly mode
    expect(screen.queryByRole("button", { name: /update/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create/i })).not.toBeInTheDocument();
  });
});
