/**
 * STUB -- Phase 6 implements the real deterministic scorer described in
 * PLAN.md (stack coverage via the skill graph, recency fit, seniority fit,
 * domain overlap, and the gate stage ahead of it). Kept as a typed shape now
 * so apps/api can wire the matching module's plumbing before the scoring
 * logic exists.
 *
 * Pure by construction: no Date.now(), no Math.random(), no importing
 * @jobhunter/db or @jobhunter/llm. Enforced by eslint.config.mjs and
 * scripts/check-boundaries.mjs -- do not add either import to this package.
 */
export interface DeterministicScoreInput {
  requiredTechnologies: string[];
  preferredTechnologies: string[];
  myTechnologies: Array<{ name: string; compositeScore: number }>;
}

export interface DeterministicScore {
  stackCoverage: number;
  preferredCoverage: number;
  matched: string[];
  missing: string[];
}

export function scoreDeterministic(_input: DeterministicScoreInput): DeterministicScore {
  throw new Error("scoreDeterministic: not yet implemented (Phase 6)");
}
