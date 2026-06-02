export type IssueType = "feature" | "bug";

export function featureBody(o: { what: string; why: string; constraints?: string }): string {
  const parts = [`## What\n\n${o.what}`, `## Why\n\n${o.why}`];
  if (o.constraints?.trim()) parts.push(`## Constraints / non-goals\n\n${o.constraints}`);
  return parts.join("\n\n");
}

export function bugBody(o: { broken: string; expected: string; where: string }): string {
  return [
    `## What's broken\n\n${o.broken}`,
    `## Expected\n\n${o.expected}`,
    `## Where\n\n${o.where}`,
  ].join("\n\n");
}

export function labelsFor(type: IssueType): string[] {
  return type === "bug" ? ["factory-idea", "bug"] : ["factory-idea"];
}
