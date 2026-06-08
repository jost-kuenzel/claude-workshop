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
