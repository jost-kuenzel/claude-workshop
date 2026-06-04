import { GlobalRegistrator } from "@happy-dom/global-registrator";
GlobalRegistrator.register();

import { describe, it, expect, afterEach, mock } from "bun:test";
// @testing-library/react must be dynamically imported AFTER GlobalRegistrator.register()
// because screen.js in @testing-library/dom captures document.body at module-load time.
// Static imports in Bun are resolved before any module body code runs (including register()),
// so screen would be initialised as a no-op fallback without a dynamic import here.
const { render, screen, waitFor, cleanup } = await import("@testing-library/react");
import React from "react";

type SimpsonsCharacter = { imageUrl: string; name: string };

let mockGetCharacter: (signal?: AbortSignal) => Promise<SimpsonsCharacter> = () =>
  Promise.reject(new Error("not set"));

mock.module("@/lib/simpsons", () => ({
  getRandomSimpsonsCharacter: (signal?: AbortSignal) => mockGetCharacter(signal),
}));

const { default: LoginPage } = await import("@/app/(auth)/login/page");

// @testing-library/react auto-cleanup relies on a global `afterEach` which Bun does
// not expose — wire it up explicitly so renders don't accumulate across tests.
afterEach(() => cleanup());

describe("LoginPage — Simpsons image panel", () => {
  it("renders an img with the character name as alt text when fetch resolves", async () => {
    mockGetCharacter = () =>
      Promise.resolve({
        imageUrl: "https://cdn.thesimpsonsapi.com/500/homer.png",
        name: "Homer Simpson",
      });

    render(<LoginPage />);

    // Component starts in "loading" state; waitFor polls until "ready" renders the <img>
    await waitFor(() => {
      expect(screen.getByRole("img")).toHaveAttribute("alt", "Homer Simpson");
    });
  });

  it("shows D'oh! placeholder and keeps form usable when fetch rejects", async () => {
    mockGetCharacter = () => Promise.reject(new Error("blocked"));

    render(<LoginPage />);

    // Placeholder renders immediately (loading state) and stays after rejection
    await waitFor(() => {
      expect(screen.getByText("D'oh!")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });
});
