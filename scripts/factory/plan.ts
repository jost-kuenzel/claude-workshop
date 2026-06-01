export interface PlanTask {
  /** 1-based task number from the checklist. */
  index: number;
  /** Title text after "Task N: " on the checklist line. */
  title: string;
  /** Whether the checklist line is checked. */
  checked: boolean;
  /** Full "### Task N: ..." detail section (heading + body), trimmed. */
  body: string;
}

export class PlanParseError extends Error {
  readonly _tag = "PlanParseError";
}

const CHECKLIST_HEADING = /^##\s+Task Checklist\s*$/m;
// Matches: "- [ ] Task 12: Some title" / "- [x] Task 12: Some title"
const CHECKLIST_LINE = /^- \[( |x)\] Task (\d+):\s*(.+?)\s*$/;

/** Extract the "### Task N: ..." section body for a given task index. */
function extractBody(markdown: string, index: number): string {
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => new RegExp(`^###\\s+Task ${index}:`).test(l));
  if (start === -1) return "";
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^###\s+Task \d+:/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n").trim();
}

export function parsePlan(markdown: string): PlanTask[] {
  const headingMatch = CHECKLIST_HEADING.exec(markdown);
  if (!headingMatch) {
    throw new PlanParseError('plan is missing a "## Task Checklist" section');
  }
  const afterHeading = markdown.slice(headingMatch.index);
  const tasks: PlanTask[] = [];
  for (const raw of afterHeading.split("\n")) {
    const m = CHECKLIST_LINE.exec(raw);
    if (!m) {
      // stop at the first non-checklist line after we've started collecting,
      // so later "- [ ]" step checkboxes are never picked up.
      if (tasks.length > 0 && raw.trim() !== "" && !raw.startsWith("- [")) break;
      continue;
    }
    const index = Number(m[2]);
    tasks.push({
      index,
      title: m[3],
      checked: m[1] === "x",
      body: extractBody(markdown, index),
    });
  }
  return tasks;
}

export function firstUnchecked(tasks: PlanTask[]): PlanTask | undefined {
  return tasks.filter((t) => !t.checked).sort((a, b) => a.index - b.index)[0];
}

export function checkOffTask(markdown: string, index: number): string {
  const pattern = new RegExp(`^(- )\\[ \\](\\s*Task ${index}:.*)$`, "m");
  if (!pattern.test(markdown)) {
    throw new PlanParseError(`no unchecked checklist line for Task ${index}`);
  }
  return markdown.replace(pattern, `$1[x]$2`);
}
