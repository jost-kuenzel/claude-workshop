import { render, screen } from "@testing-library/react";
import VersionFooter from "@/components/VersionFooter";

describe("VersionFooter", () => {
  it("renders the version string", () => {
    render(<VersionFooter />);
    expect(screen.getByText("ACME CRM v1.0.0")).toBeInTheDocument();
  });
});
