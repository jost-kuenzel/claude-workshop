export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function specFilename(stamp: string, issue: number, slug: string): string {
  return `docs/superpowers/specs/${stamp}--issue-${issue}--${slug}--design.md`;
}

export function buildFrontmatter(o: { name: string; description: string; issue: number }): string {
  return [
    "---",
    `name: ${o.name}`,
    `description: ${o.description}`,
    "status: draft",
    `issue: ${o.issue}`,
    "---",
  ].join("\n");
}
