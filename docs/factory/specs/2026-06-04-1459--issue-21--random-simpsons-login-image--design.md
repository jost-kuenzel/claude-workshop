---
name: random-simpsons-login-image
description: Show a random Simpsons character image beside the login card, fetched client-side per page load, with a placeholder fallback.
status: draft
issue: 21
---

# Random Simpsons image beside the login page

## Problem

The login page (`src/app/(auth)/login/page.tsx`) is a plain centered card with an
email/password form. We want to add a bit of personality: a random Simpsons
character image displayed beside the login card. The image is purely decorative
and must never block or degrade the login flow.

## Goals / non-goals

- **Goal:** Fetch a random Simpsons character image from an external API
  (`thesimpsonsapi.com`) on each page load, client-side, and render it beside the
  login `Card` on `md+` screens.
- **Goal:** Graceful degradation — a placeholder shows during loading and on any
  failure, and the form stays fully usable.
- **Non-goal:** A shuffle/refresh button (random-on-load only).
- **Non-goal:** Homer-only filtering — any Simpsons character is acceptable.
- **Non-goal:** Server-side proxy route, image caching, or `next/image`
  optimization (see Rejected alternatives).

## Architecture & approach

Approach **A — client-side fetch via an isolated helper**. The login page is
already a client component (`"use client"`). The API is encapsulated in a single
new module, `src/lib/simpsons.ts`, so it is the only place that knows the API
shape and base URLs. The page calls the helper from a `useEffect` on mount and
renders either the image or a placeholder based on status.

The browser talks to the API directly. The Next server never fetches the remote
image, so there is no server-side network dependency and no `next/image`
optimization round-trip.

### Rejected alternatives

- **B — server-side proxy route** (`/api/simpsons/random`): hides the API and
  sidesteps browser CORS, but server-side fetch is firewall-blocked in the
  sandbox (so it would _always_ show the placeholder in dev/preview) and adds a
  route + caching surface. Not worth it for a decorative image.
- **C — Server Component wrapper**: same firewall problem as B, and the page is
  already a client component.
- **`next/image`**: would trigger the Next server to fetch/optimize the remote
  image at runtime, reintroducing a server-side network dependency and requiring
  `remotePatterns` config. A plain `<img>` keeps the fetch purely client-side.

## Components

### 1. `src/lib/simpsons.ts` (new)

The isolated API client. Public contract:

```ts
export type SimpsonsCharacter = { imageUrl: string; name: string };

export async function getRandomSimpsonsCharacter(signal?: AbortSignal): Promise<SimpsonsCharacter>;
```

- Module-level constants for base URLs so adjustments live in one place:
  - `API_BASE = "https://thesimpsonsapi.com/api"`
  - `CDN_BASE = "https://cdn.thesimpsonsapi.com/500"`
- Strategy:
  1. `GET ${API_BASE}/characters` (page 1) and read the total page count from the
     response (e.g. `pages`).
  2. Pick a random page in `[1, pages]` and `GET ${API_BASE}/characters?page=<n>`.
  3. Pick a random entry from that page's `results`.
  4. Build `imageUrl` from the entry's `portrait_path`
     (`${CDN_BASE}${portrait_path}`) and return `{ imageUrl, name }`.
- Passes `signal` to every `fetch` so callers can abort (timeout / unmount).
- **Throws** on: non-OK HTTP status, empty `results`, or malformed/missing JSON
  fields. Callers treat any throw as "show the placeholder".
- The exact response field names are confirmed at implementation time against the
  live API; because they live only in this module, adjusting them is a localized
  change. If a field is missing, the helper throws (→ placeholder), so an
  optimistic mapping is safe.

### 2. `src/app/(auth)/login/page.tsx` (modified)

- New state:
  - `character: SimpsonsCharacter | null`
  - `imageStatus: "loading" | "ready" | "error"` (starts `"loading"`)
- `useEffect` on mount:
  - Create an `AbortController`; build a timeout signal of ~8s
    (`AbortSignal.timeout(8000)`) combined with the controller's signal so a
    hanging request falls back to the placeholder.
  - Call `getRandomSimpsonsCharacter(signal)`; on success set `character` +
    `imageStatus="ready"`, on any error set `imageStatus="error"`.
  - Cleanup: `controller.abort()` on unmount to avoid setState-after-unmount.
- Rendering uses a plain `<img>` (not `next/image`) with `alt={character.name}`,
  fixed dimensions, and rounded styling. One inline
  `// eslint-disable-next-line @next/next/no-img-element` keeps lint green; the
  rationale (client-only fetch, no server optimization) is noted in a short
  comment.

### 3. Placeholder

- A styled box matching the image slot's dimensions, using existing Tailwind
  tokens (`bg-muted`, `text-muted-foreground`, rounded), showing a donut (🍩) and
  the text "D'oh!".
- Shown while `imageStatus` is `"loading"` **or** `"error"`, so the slot is never
  empty; replaced by the `<img>` when `"ready"`.
- No new asset is committed.

### Layout

- The page wrapper becomes a centered responsive flex row: the image column sits
  **beside** the `Card` on `md+` screens (`hidden md:flex`) and is **hidden on
  small screens** to keep the form clean (the image is decorative).
- The existing `Card` / form markup is unchanged inside the new wrapper.

## Data flow

```
mount
  → useEffect
    → getRandomSimpsonsCharacter(signal)
        → fetch /characters (page 1) → read total pages
        → fetch /characters?page=<random>
        → pick random result → build imageUrl
    → success: imageStatus="ready", character set → <img> renders
    → failure/timeout: imageStatus="error" → placeholder renders
unmount → controller.abort()
```

Each page load repeats the effect → a new random character.

## Error handling & constraints

- Any helper throw (network error, non-OK, empty results, malformed JSON) →
  `imageStatus="error"` → placeholder. The login form is never blocked by image
  failure.
- `AbortController` cleanup prevents setState-after-unmount.
- ~8s timeout via `AbortSignal.timeout` so a hanging API degrades to the
  placeholder instead of an indefinite loading state.

Documented constraints:

- **Sandbox firewall:** `thesimpsonsapi.com` is blocked by the sandbox's
  default-deny network policy, so local dev/preview shows the placeholder. This is
  expected. To see real images locally, allowlist the domains on the host:
  `sbx policy allow network -g thesimpsonsapi.com,cdn.thesimpsonsapi.com`.
- **CORS:** if the API omits `Access-Control-Allow-Origin`, the browser fetch
  fails → placeholder. This is the main third-party risk and is handled by the
  same fallback path.

## Testing

Bun test + happy-dom, matching existing patterns (`bun:test`, `mock.module`,
`@testing-library/react`).

- `src/lib/__tests__/simpsons.test.ts`:
  - Stub `global.fetch` and `Math.random` for determinism.
  - Success path → returns `{ imageUrl, name }` with a `CDN_BASE`-prefixed URL.
  - Non-OK response → throws.
  - Empty `results` → throws.
- `src/app/(auth)/login/__tests__/page.test.tsx`:
  - Mock `@/lib/simpsons`.
  - Success → after the effect resolves, an `<img>` with the character's `alt`
    text is present.
  - Rejection → the "D'oh!" placeholder is present **and** the email/password
    inputs and the Sign in button still render (form remains usable).
- Existing auth route tests are untouched.

### Verification

- `npm run test`
- `npm run lint`
- Manual (optional, requires allowlisting the API domains): load `/login` and
  confirm a Simpsons image appears beside the card on a wide viewport, is hidden
  on mobile width, and that the placeholder shows when the API is blocked.
