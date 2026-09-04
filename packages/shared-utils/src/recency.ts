/**
 * How much a technology's usage counts toward its current-proficiency score,
 * given how many months ago it was last touched. A tech unused for a full
 * half-life still counts at half weight rather than dropping to zero — this
 * is what lets "recent work" outweigh old CV lines without erasing them.
 *
 * Pure and deterministic on purpose: packages/matching's golden-file tests
 * depend on this never reading the clock itself. Callers pass `monthsAgo`;
 * this never calls Date.now().
 */
const HALF_LIFE_MONTHS = 12;

export function recencyWeight(monthsAgo: number): number {
  if (monthsAgo < 0) {
    throw new Error(`recencyWeight: monthsAgo must be >= 0, got ${monthsAgo}`);
  }
  return Math.pow(0.5, monthsAgo / HALF_LIFE_MONTHS);
}

/**
 * How much a single work entry contributes to a technology's depth score,
 * by the kind of work it represents. `learning: 0.15` is load-bearing: an
 * entry that only records reading about a technology must never be enough,
 * on its own, to promote that technology to a resume-emittable claim.
 */
export const WORK_ENTRY_TYPE_DEPTH = {
  architecture: 1.0,
  performance: 0.9,
  security: 0.9,
  integration: 0.8,
  feature: 0.7,
  infra: 0.7,
  refactor: 0.5,
  fix: 0.4,
  release: 0.3,
  docs: 0.2,
  learning: 0.15,
} as const satisfies Record<string, number>;
