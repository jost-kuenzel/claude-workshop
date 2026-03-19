import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockSetTheme = vi.fn();

vi.mock("next-themes", () => ({
  useTheme: vi.fn(() => ({ theme: "light", setTheme: mockSetTheme })),
}));

// Also mock next/font/google and next/navigation to avoid Next.js internals
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  usePathname: vi.fn(() => "/"),
}));

describe("ThemeToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a button", async () => {
    const ThemeToggle = (await import("@/components/ThemeToggle")).default;
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: /toggle theme/i });
    expect(button).toBeInTheDocument();
  });

  it("shows the current theme label when mounted", async () => {
    const ThemeToggle = (await import("@/components/ThemeToggle")).default;
    render(<ThemeToggle />);
    // After mount, should show 'Light' (theme is 'light')
    expect(screen.getByRole("button")).toHaveTextContent(/light/i);
  });

  it("calls setTheme when button is clicked", async () => {
    const user = userEvent.setup();
    const ThemeToggle = (await import("@/components/ThemeToggle")).default;
    render(<ThemeToggle />);

    const button = screen.getByRole("button", { name: /toggle theme/i });
    await user.click(button);
    expect(mockSetTheme).toHaveBeenCalledOnce();
  });

  it("cycles from light to dark when clicked", async () => {
    const user = userEvent.setup();
    const ThemeToggle = (await import("@/components/ThemeToggle")).default;
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: /toggle theme/i }));
    // light (index 1) → dark (index 2)
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });
});
