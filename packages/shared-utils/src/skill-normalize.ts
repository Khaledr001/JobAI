/**
 * Normalizes a technology/skill mention for alias lookup.
 *
 * Deliberately NOT the same as a generic search-key normalizer (the kind
 * that strips accents and punctuation for product-search matching). Doing
 * that here would silently merge "C#" into "C", "C++" into "C", and ".NET"
 * into "NET" -- three real, distinct skills becoming unmatchable. This
 * normalizer folds case and collapses whitespace but explicitly preserves
 * `#`, `+`, and `.`.
 */
export function normalizeSkillMention(raw: string): string {
  return raw
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s#+.-]/gu, "");
}
