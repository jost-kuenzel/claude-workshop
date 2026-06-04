import { render, screen } from "@testing-library/react";
import { Button, buttonVariants } from "@/components/ui/button";

describe("Button", () => {
  it("renders with the correct role and text", () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole("button", { name: "Click me" });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent("Click me");
  });

  it("applies the secondary variant class when variant='secondary'", () => {
    render(<Button variant="secondary">Secondary</Button>);
    const btn = screen.getByRole("button", { name: "Secondary" });
    // buttonVariants({ variant: "secondary" }) includes "bg-secondary"
    expect(btn.className).toContain("bg-secondary");
  });
});
