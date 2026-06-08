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
