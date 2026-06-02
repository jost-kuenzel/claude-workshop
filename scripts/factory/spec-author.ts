export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function specFilename(stamp: string, issue: number, slug: string): string {
  return `docs/superpowers/specs/${stamp}--issue-${issue}--${slug}--design.md`;
}

function yamlString(v: string): string {
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function buildFrontmatter(o: { name: string; description: string; issue: number }): string {
  return [
    "---",
    `name: ${yamlString(o.name)}`,
    `description: ${yamlString(o.description)}`,
    "status: draft",
    `issue: ${o.issue}`,
    "---",
  ].join("\n");
}
