/**
 * Strips a source's raw HTML down to plain text before a job description
 * ever reaches a prompt (PLAN.md: only sanitised, structured fields
 * propagate downstream, never raw JD text). Greenhouse's `content` field
 * comes back HTML-entity-ESCAPED HTML (e.g. the literal string
 * `"&lt;div&gt;"`, not a real `<div>` tag) -- decoding must run to a fixed
 * point before tag-stripping can see any tags at all.
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

const ENTITY_RE = /&(#\d+|#x[0-9a-f]+|[a-z]+);/gi;

function decodeEntitiesOnce(input: string): string {
  return input.replace(ENTITY_RE, (match, entity: string) => {
    if (entity[0] === "#") {
      const isHex = entity[1] === "x" || entity[1] === "X";
      const codePoint = isHex
        ? parseInt(entity.slice(2), 16)
        : parseInt(entity.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Capped, not unbounded: a decode loop that never reaches a fixed point (adversarial input) must still terminate. */
const MAX_DECODE_PASSES = 5;

export function sanitizeHtml(input: string): string {
  let text = input;
  for (let i = 0; i < MAX_DECODE_PASSES; i++) {
    const decoded = decodeEntitiesOnce(text);
    if (decoded === text) break;
    text = decoded;
  }
  text = text.replace(/<[^>]*>/g, " ");
  return text.replace(/\s+/g, " ").trim();
}
