import { vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import LoginPage from "@/app/(auth)/login/page";

type SimpsonsCharacter = { imageUrl: string; name: string };

let mockGetCharacter: (signal?: AbortSignal) => Promise<SimpsonsCharacter> = () =>
  Promise.reject(new Error("not set"));

vi.mock("@/lib/simpsons", () => ({
  getRandomSimpsonsCharacter: (signal?: AbortSignal) => mockGetCharacter(signal),
}));

describe("LoginPage — Simpsons image panel", () => {
  it("renders an img with the character name as alt text when fetch resolves", async () => {
    mockGetCharacter = () =>
      Promise.resolve({
        imageUrl: "https://cdn.thesimpsonsapi.com/500/homer.png",
        name: "Homer Simpson",
      });

    render(<LoginPage />);

    await waitFor(() => {
      expect(screen.getByRole("img")).toHaveAttribute("alt", "Homer Simpson");
    });
  });

  it("shows D'oh! placeholder and keeps form usable when fetch rejects", async () => {
    mockGetCharacter = () => Promise.reject(new Error("blocked"));

    render(<LoginPage />);

    await waitFor(() => {
      expect(screen.getByText("D'oh!")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });
});
