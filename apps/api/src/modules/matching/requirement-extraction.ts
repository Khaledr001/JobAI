import type { RequiredTechnology } from "@jobhunter/matching";

/**
 * A deterministic stand-in for PLAN.md's Stage A/B JD parsing (LLM-based
 * structured extraction is explicitly deferred -- see docs/DECISIONS.md
 * D35). This is a plain keyword scan: every taxonomy node whose canonical
 * name or any alias appears in the JD text, at a word boundary, becomes a
 * required technology, quoting the actual matched substring verbatim (the
 * same "quote must be real" discipline PLAN.md's extraction pipeline uses
 * elsewhere). Pure and DB-free by construction -- the caller resolves the
 * taxonomy list from Postgres; this function only sees plain strings.
 */
export interface TaxonomyMention {
  canonicalName: string;
  aliases: string[];
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Neighboring characters must not be letters/digits -- a crude word boundary that still works for "C#"/"C++"/".NET". */
function findVerbatimMention(text: string, mention: string): string | null {
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegex(mention)}(?![\\p{L}\\p{N}])`,
    "iu",
  );
  const match = pattern.exec(text);
  return match ? match[0] : null;
}

export function extractRequirements(
  jobText: string,
  taxonomy: readonly TaxonomyMention[],
): RequiredTechnology[] {
  const found: RequiredTechnology[] = [];
  for (const node of taxonomy) {
    const mentions = [node.canonicalName, ...node.aliases].filter(
      (m) => m.trim().length >= 2,
    );
    for (const mention of mentions) {
      const quote = findVerbatimMention(jobText, mention);
      if (quote) {
        found.push({ name: node.canonicalName, necessity: "required", quote });
        break;
      }
    }
  }
  return found;
}
