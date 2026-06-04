export type SimpsonsCharacter = { imageUrl: string; name: string };

const API_BASE = "https://thesimpsonsapi.com/api";
const CDN_BASE = "https://cdn.thesimpsonsapi.com/500";

export async function getRandomSimpsonsCharacter(signal?: AbortSignal): Promise<SimpsonsCharacter> {
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
