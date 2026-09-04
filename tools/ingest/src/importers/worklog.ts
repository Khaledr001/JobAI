import { readFileSync } from "node:fs";
import { upsertProject, upsertWorkEntry, type IngestContext } from "../lib/writer.js";

/**
 * `work-log.txt` uses `DD/MM/YYYY`, and at least one entry ("01/09/2026")
 * is ambiguous with `MM/DD/YYYY` in isolation. PLAN.md's answer: parse as
 * `DD/MM` and assert the resulting sequence is monotonically
 * non-decreasing across the whole file -- if a date is genuinely
 * out of order, that's a real data problem to raise, not guess past.
 * (The ambiguous "01/09/2026" only keeps the sequence increasing under the
 * DD/MM reading, which is itself a small self-check that the format
 * assumption is right.)
 */
interface DayBlock {
  date: string; // ISO
  isWeeklyReport: boolean;
  isFuturePlan: boolean;
  entries: Map<string, string[]>; // project name -> bullets (or "" for unattributed lines)
}

const DATE_HEADER_RE = /^Work Log\s*-?\s*(\d{2})\/(\d{2})\/(\d{4})\s*$/i;
const WEEKLY_REPORT_RE = /^Weekly Report\s*-?\s*$/i;
const NEXT_WEEK_RE = /^Next week plan\s*$/i;
const PROJECT_RE = /^Project\s*-\s*(.+)$/i;
const BULLET_RE = /^-\s+(.+)$/;
const URL_RE = /^https?:\/\//;

function parseDdMmYyyy(dd: string, mm: string, yyyy: string): string {
  const day = Number(dd);
  const month = Number(mm);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error(
      `worklog: "${dd}/${mm}/${yyyy}" does not look like a valid DD/MM/YYYY date`,
    );
  }
  return `${yyyy}-${mm}-${dd}`;
}

export function parseWorkLog(text: string): DayBlock[] {
  const lines = text.split("\n").map((l) => l.trim());
  const blocks: DayBlock[] = [];
  let current: DayBlock | null = null;
  let currentProject = "";

  for (const line of lines) {
    if (line === "") continue;

    const dateMatch = DATE_HEADER_RE.exec(line);
    if (dateMatch) {
      current = {
        date: parseDdMmYyyy(dateMatch[1]!, dateMatch[2]!, dateMatch[3]!),
        isWeeklyReport: false,
        isFuturePlan: false,
        entries: new Map(),
      };
      blocks.push(current);
      currentProject = "";
      continue;
    }

    if (WEEKLY_REPORT_RE.test(line)) {
      // No date of its own -- inherits the most recently seen dated block's
      // date, since it always immediately follows that day's entries.
      const lastDated = [...blocks]
        .reverse()
        .find((b) => !b.isWeeklyReport && !b.isFuturePlan);
      current = {
        date: lastDated?.date ?? "unknown",
        isWeeklyReport: true,
        isFuturePlan: false,
        entries: new Map(),
      };
      blocks.push(current);
      currentProject = "";
      continue;
    }

    if (NEXT_WEEK_RE.test(line)) {
      // Planned, not done -- excluded from work_entries entirely (see
      // importWorkLog below). Tracked as its own block only so monotonicity
      // checking and project-line parsing can skip it cleanly.
      current = {
        date: "future",
        isWeeklyReport: false,
        isFuturePlan: true,
        entries: new Map(),
      };
      blocks.push(current);
      currentProject = "";
      continue;
    }

    if (!current) continue; // preamble before the first dated header, if any

    const projectMatch = PROJECT_RE.exec(line);
    if (projectMatch) {
      currentProject = projectMatch[1]!.trim();
      if (!current.entries.has(currentProject)) current.entries.set(currentProject, []);
      continue;
    }

    if (URL_RE.test(line)) continue; // ClickUp links -- not separately meaningful once attached to a day+project

    const bulletMatch = BULLET_RE.exec(line);
    const text2 = bulletMatch ? bulletMatch[1]!.trim() : line;
    const key = currentProject || "(unspecified)";
    const list = current.entries.get(key) ?? [];
    list.push(text2);
    current.entries.set(key, list);
  }

  assertMonotonic(blocks);
  return blocks;
}

function assertMonotonic(blocks: DayBlock[]): void {
  let lastDate: string | null = null;
  for (const block of blocks) {
    if (block.isFuturePlan || block.date === "unknown") continue;
    if (lastDate && block.date < lastDate) {
      throw new Error(
        `worklog: date ${block.date} appears after ${lastDate} in file order -- the DD/MM/YYYY ` +
          `parse assumption may be wrong for this entry, or the file has a real ordering problem. Refusing to guess.`,
      );
    }
    lastDate = block.date;
  }
}

function classify(isWeeklyReport: boolean): "feature" | "docs" {
  return isWeeklyReport ? "docs" : "feature";
}

export async function importWorkLog(ctx: IngestContext, filePath: string): Promise<void> {
  console.log(`\n=== work-log: ${filePath} ===`);
  const blocks = parseWorkLog(readFileSync(filePath, "utf8"));

  for (const block of blocks) {
    if (block.isFuturePlan) continue; // planned work is not evidence of work done
    if (block.date === "unknown") continue; // a "Weekly Report" with nothing dated before it

    for (const [projectName, bullets] of block.entries) {
      if (bullets.length === 0) continue;

      let projectId: string | undefined;
      if (projectName !== "(unspecified)") {
        projectId = await upsertProject(ctx, {
          name: projectName,
          slug: projectName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, ""),
        });
      }

      const body = bullets.join(" ");
      await upsertWorkEntry(ctx, {
        projectId,
        title: `${projectName} (${block.date}${block.isWeeklyReport ? ", weekly report" : ""}): ${bullets[0]!.slice(0, 50)}`,
        body,
        type: classify(block.isWeeklyReport),
        occurredOn: block.date,
        sourceKind: "log_line",
        sourceRef: filePath,
      });
    }
  }
}
