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
