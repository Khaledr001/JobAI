/**
 * The "strong key" tier of PLAN.md's dedup cascade: exact
 * `(company, source_job_id)` (handled at the write path via
 * `job_source_listing`'s own unique key, not here) -> this strong key ->
 * fuzzy `pg_trgm`/embedding tiers (SQL-level, not this package -- see
 * `sql/06-jobs.sql`). Pure and deterministic: the same three inputs always
 * produce the same key, which is what lets a re-ingest of an unchanged
 * listing land on the same `job_canonical` row instead of a duplicate.
 */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function strongDedupKey(
  company: string,
  title: string,
  location: string | null,
): string {
  return [normalize(company), normalize(title), location ? normalize(location) : ""].join(
    "|",
  );
}
