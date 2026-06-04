---
issue: 21
spec: docs/factory/specs/2026-06-04-1459--issue-21--random-simpsons-login-image--design.md
---

# Random Simpsons Image on Login — Implementation Plan

**Goal:** Fetch a random Simpsons character image client-side on each page load and display it beside the login card on `md+` screens, with a styled placeholder during loading and on error.

**Architecture:** A new `src/lib/simpsons.ts` module owns all Simpsons API knowledge (endpoint constants, two-step fetch, random page/entry selection, CDN URL construction). The login page at `src/app/(auth)/login/page.tsx` calls it from a `useEffect` with an `AbortController` + 8-second `setTimeout` fallback, drives `imageStatus` state (`"loading" | "ready" | "error"`), and wraps the existing `Card` in a responsive flex row — image column `hidden md:flex` beside the card.

**Tech Stack:** Next.js 16 / React 19 (`"use client"`), Tailwind CSS 4, Bun test runner (`bun:test`), `@testing-library/react` v16 + `@happy-dom/global-registrator` v20 for DOM setup in component tests.

## Task Checklist

- [ ] Task 1: Create Simpsons API helper with unit tests
- [ ] Task 2: Update login page with image column and component tests

---

### Task 1: Create Simpsons API helper with unit tests

**Files:**

- Create: `src/lib/simpsons.ts`
- Test: `src/lib/__tests__/simpsons.test.ts`

- [ ] Step 1: Write `src/lib/__tests__/simpsons.test.ts` — three tests that will fail because the module does not exist yet.

  Create the file with this exact content:

  ```ts
  import { describe, it, expect, beforeEach, afterEach } from "bun:test";
  import { getRandomSimpsonsCharacter } from "@/lib/simpsons";

  describe("getRandomSimpsonsCharacter", () => {
    let originalFetch: typeof global.fetch;
    let originalRandom: typeof Math.random;

    beforeEach(() => {
      originalFetch = global.fetch;
      originalRandom = Math.random;
      // deterministic: Math.random() === 0 picks page 1 and entry at index 0
      Math.random = () => 0;
    });

    afterEach(() => {
      global.fetch = originalFetch;
      Math.random = originalRandom;
    });

    it("returns imageUrl prefixed with CDN_BASE and character name on success", async () => {
      let callCount = 0;
      global.fetch = async (_url: string | URL | Request, _init?: RequestInit) => {
        callCount++;
        if (callCount === 1) {
          // First call: GET /characters page 1 — reveals total page count
          return new Response(JSON.stringify({ pages: 3, results: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        // Second call: GET /characters?page=<n>
        return new Response(
          JSON.stringify({
            results: [{ portrait_path: "/homer.png", name: "Homer Simpson" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const result = await getRandomSimpsonsCharacter();

      expect(result.imageUrl).toBe("https://cdn.thesimpsonsapi.com/500/homer.png");
      expect(result.name).toBe("Homer Simpson");
    });

    it("throws when the first HTTP response is non-OK", async () => {
      global.fetch = async () => new Response(null, { status: 500 });
      await expect(getRandomSimpsonsCharacter()).rejects.toThrow();
    });

    it("throws when results array is empty", async () => {
      let callCount = 0;
      global.fetch = async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify({ pages: 1, results: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ results: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };
      await expect(getRandomSimpsonsCharacter()).rejects.toThrow();
    });
  });
  ```

- [ ] Step 2: Run `bun test src/lib/__tests__/simpsons.test.ts` — expect **FAIL** (`Cannot find module '@/lib/simpsons'`).

- [ ] Step 3: Create `src/lib/simpsons.ts`:

  ```ts
  export type SimpsonsCharacter = { imageUrl: string; name: string };

  const API_BASE = "https://thesimpsonsapi.com/api";
  const CDN_BASE = "https://cdn.thesimpsonsapi.com/500";

  export async function getRandomSimpsonsCharacter(
    signal?: AbortSignal
  ): Promise<SimpsonsCharacter> {
    const firstRes = await fetch(`${API_BASE}/characters`, { signal });
    if (!firstRes.ok) throw new Error(`HTTP ${firstRes.status}`);
    const firstData: { pages: number } = await firstRes.json();
    if (!firstData.pages) throw new Error("Missing pages field");

    const page = Math.floor(Math.random() * firstData.pages) + 1;
    const pageRes = await fetch(`${API_BASE}/characters?page=${page}`, { signal });
    if (!pageRes.ok) throw new Error(`HTTP ${pageRes.status}`);
    const pageData: {
      results: Array<{ portrait_path: string; name: string }>;
    } = await pageRes.json();

    if (!pageData.results || pageData.results.length === 0) throw new Error("Empty results");

    const entry = pageData.results[Math.floor(Math.random() * pageData.results.length)];
    if (!entry.portrait_path || !entry.name) throw new Error("Malformed entry");

    return { imageUrl: `${CDN_BASE}${entry.portrait_path}`, name: entry.name };
  }
  ```

- [ ] Step 4: Run `bun test src/lib/__tests__/simpsons.test.ts` — expect **PASS** (all 3 tests green).

- [ ] Step 5: Run `npm run lint` — fix any issues, re-run to confirm clean.

- [ ] Step 6: Commit: `feat: add Simpsons API helper (getRandomSimpsonsCharacter)`

---

### Task 2: Update login page with image column and component tests

**Files:**

- Modify: `src/app/(auth)/login/page.tsx`
- Test: `src/app/(auth)/login/__tests__/page.test.tsx`

**Context:** `src/test/setup.bun.ts` (the preload file, automatically loaded by Bun before every test file) already mocks `next/navigation` globally — `useRouter` is covered in all tests without any extra setup.

Component tests need a real DOM. This project uses `@happy-dom/global-registrator` for that. Call `GlobalRegistrator.register()` at the top of the test file (in the module body, before any `describe`/`it` calls). Bun resolves all `import` statements first, then runs module body code in order — so `GlobalRegistrator.register()` runs before any test callbacks, giving `@testing-library/react`'s `render()` a working `document`.

`mock.module` must be called before `await import(...)` so the login page receives the mock when it imports `@/lib/simpsons`. The mutable `mockGetCharacter` variable lets each test control the mock's behaviour at runtime.

- [ ] Step 1: Create directory `src/app/(auth)/login/__tests__/` and write `page.test.tsx` — two tests that will fail because the login page has no `<img>` or placeholder yet.

  ```tsx
  import { GlobalRegistrator } from "@happy-dom/global-registrator";
  GlobalRegistrator.register();

  import { describe, it, expect, afterAll, mock } from "bun:test";
  import { render, screen, waitFor } from "@testing-library/react";
  import React from "react";

  type SimpsonsCharacter = { imageUrl: string; name: string };

  let mockGetCharacter: (signal?: AbortSignal) => Promise<SimpsonsCharacter>;

  mock.module("@/lib/simpsons", () => ({
    getRandomSimpsonsCharacter: (signal?: AbortSignal) => mockGetCharacter(signal),
  }));

  const { default: LoginPage } = await import("@/app/(auth)/login/page");

  afterAll(() => GlobalRegistrator.unregister());

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
  ```

- [ ] Step 2: Run `bun test src/app/(auth)/login/__tests__/page.test.tsx` — expect **FAIL** (`Unable to find an accessible element with the role "img"` — the current page has no image element).

- [ ] Step 3: Replace the full contents of `src/app/(auth)/login/page.tsx` with:

  ```tsx
  "use client";

  import { useState, useEffect, type FormEvent } from "react";
  import { useRouter } from "next/navigation";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Label } from "@/components/ui/label";
  import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
  import { getRandomSimpsonsCharacter, type SimpsonsCharacter } from "@/lib/simpsons";

  export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [character, setCharacter] = useState<SimpsonsCharacter | null>(null);
    const [imageStatus, setImageStatus] = useState<"loading" | "ready" | "error">("loading");
    const router = useRouter();

    useEffect(() => {
      const controller = new AbortController();
      // abort the fetch if it takes more than 8s, so a slow API degrades to the placeholder
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      getRandomSimpsonsCharacter(controller.signal)
        .then((char) => {
          setCharacter(char);
          setImageStatus("ready");
        })
        .catch(() => {
          setImageStatus("error");
        });

      return () => {
        clearTimeout(timeoutId);
        controller.abort();
      };
    }, []);

    async function handleSubmit(e: FormEvent) {
      e.preventDefault();
      setError("");
      setLoading(true);

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Login failed");
          return;
        }

        // Small delay to ensure cookie is set before navigating
        await new Promise((resolve) => setTimeout(resolve, 100));
        router.push("/dashboard");
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-row items-center gap-8">
          {/* Image column: visible only on md+ screens; purely decorative */}
          <div className="hidden md:flex items-center justify-center w-64 h-80">
            {imageStatus === "ready" && character ? (
              // Plain <img> keeps the fetch purely client-side (no Next server round-trip)
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={character.imageUrl}
                alt={character.name}
                width={256}
                height={320}
                className="rounded-lg object-cover w-full h-full"
              />
            ) : (
              <div className="flex flex-col items-center justify-center w-full h-full bg-muted text-muted-foreground rounded-lg">
                <span className="text-4xl">🍩</span>
                <span className="mt-2 text-sm font-medium">D&apos;oh!</span>
              </div>
            )}
          </div>
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle className="text-2xl text-center">ACME CRM</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign in"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  ```

- [ ] Step 4: Run `bun test src/app/(auth)/login/__tests__/page.test.tsx` — expect **PASS** (both tests green).

- [ ] Step 5: Run `npm run test` — expect all tests pass (existing auth route tests untouched).

- [ ] Step 6: Run `npm run lint` — fix any issues, re-run to confirm clean.

- [ ] Step 7: Commit: `feat: show random Simpsons character beside login card`
