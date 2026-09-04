import { readFileSync } from "node:fs";
import {
  createClaimWithEvidence,
  upsertProject,
  upsertWorkEntry,
  type IngestContext,
} from "../lib/writer.js";

/**
 * `PROJECT_DOCUMENTATION.md` exists in two dated copies for the same
 * project (Sidago/ and Sidago/Mazarini/) that disagree with each other
 * about a milestone already in the past by the time either was written --
 * see PLAN.md's Mazarini module-count conflict. Both get ingested as
 * independent evidence; the conflict detector (lib/conflicts.ts) is what
 * notices they disagree, not this file.
 *
 * The claim `subject` below is deliberately identical across every source
 * that reports this count (resume.md, portfolio, and both doc copies) --
 * that shared subject string is the join key the conflict detector groups
 * on.
 */
const MODULE_COUNT_SUBJECT = "Mazarini content module count";

interface ParsedDoc {
  preparedDate: string; // ISO
  moduleCount: { count: number; unit: string } | null;
  completedPhases: Array<{
    number: string;
    name: string;
    startedOn: string;
    endedOn: string;
  }>;
}

function parseHeaderDate(text: string): string {
  const m = /\*\*Date:\*\*\s*(\d{4}-\d{2}-\d{2})/.exec(text);
  if (!m) throw new Error("doc: could not find a **Date:** header line");
  return m[1]!;
}

/** e.g. "All 27 Strapi content types defined" or "All 32 Strapi content types defined". */
function parseModuleCount(text: string): { count: number; unit: string } | null {
  const m = /All\s+(\d+)\s+Strapi content types/.exec(text);
  if (!m) return null;
  return { count: Number(m[1]), unit: "content_types" };
}

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

/** "Feb 10, 2026" -> "2026-02-10". */
function parseLongDate(text: string): string | null {
  const m = /^([A-Za-z]{3})[a-z]*\s+(\d{1,2}),\s*(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const month = MONTHS[m[1]!.toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${month}-${m[2]!.padStart(2, "0")}`;
}

/**
 * Only well-formed, single-line phase rows are extracted -- the older doc
 * has a phase row broken across three lines by a stray newline inside the
 * table (a real formatting defect in the source file). Skipping what
 * doesn't parse cleanly is the right behaviour here: the milestone count
 * above is the load-bearing extraction, this is enrichment.
 */
function parsePhaseTable(text: string): ParsedDoc["completedPhases"] {
  const rows: ParsedDoc["completedPhases"] = [];
  const rowRe =
    /^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*(✅[^|]*)\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/gm;
  for (const m of text.matchAll(rowRe)) {
    const startedOn = parseLongDate(m[4]!);
    const endedOn = parseLongDate(m[5]!);
    if (!startedOn || !endedOn) continue;
    rows.push({ number: m[1]!, name: m[2]!.trim(), startedOn, endedOn });
  }
  return rows;
}

export function parseProjectDocumentation(text: string): ParsedDoc {
  return {
    preparedDate: parseHeaderDate(text),
    moduleCount: parseModuleCount(text),
    completedPhases: parsePhaseTable(text),
  };
}

export async function importProjectDocumentation(
  ctx: IngestContext,
  filePath: string,
): Promise<void> {
  console.log(`\n=== doc: ${filePath} ===`);
  const text = readFileSync(filePath, "utf8");
  const doc = parseProjectDocumentation(text);

  const projectId = await upsertProject(ctx, {
    name: "Mazarini",
    slug: "mazarini",
    description: "Full-stack corporate website (construction/contracting industry)",
  });

  for (const phase of doc.completedPhases) {
    await upsertWorkEntry(ctx, {
      projectId,
      title: `Mazarini Phase ${phase.number}: ${phase.name}`,
      body: `Completed Phase ${phase.number} — ${phase.name} (${phase.startedOn} to ${phase.endedOn}).`,
      type: "feature",
      occurredOn: phase.startedOn,
      occurredThrough: phase.endedOn,
      sourceKind: "doc_section",
      sourceRef: filePath,
    });
  }

  if (doc.moduleCount) {
    await createClaimWithEvidence(ctx, {
      kind: "metric",
      subject: MODULE_COUNT_SUBJECT,
      statement: `Mazarini shipped with ${doc.moduleCount.count} Strapi content types defined and related.`,
      quantities: { count: doc.moduleCount.count, unit: doc.moduleCount.unit },
      evidence: [
        {
          kind: "doc_section",
          locator: filePath,
          excerpt: `M1 milestone, documented ${doc.preparedDate}`,
          occurredOn: doc.preparedDate,
        },
      ],
    });
  }
}

export { MODULE_COUNT_SUBJECT };
