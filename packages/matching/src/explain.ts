import { evaluateGates } from "./gates.js";
import { scoreDeterministic } from "./score.js";
import type { MatchBand, MatchExplanation, MatchInput, SubScores } from "./types.js";

/**
 * Bumped whenever the scoring formula (weights, gate logic, sub-score
 * definitions) changes -- part of `match_scores`' stability key
 * (job_version, profile_version, scorer_version) so identical inputs give
 * identical output until one of those three actually changes (PLAN.md
 * §Matching engine).
 */
export const SCORER_VERSION = "matching-v1";

const HEADLINE_WEIGHTS = {
  stackFit: 0.45,
  recencyFit: 0.2,
  seniorityFit: 0.2,
  domainOverlap: 0.15,
} as const satisfies Record<keyof SubScores, number>;

/** Provisional (PLAN.md): seeded now, recalibrated once >=30 applications have outcomes. */
const BAND_THRESHOLDS = { strong: 80, worthApplying: 60 };

function computeHeadline(subScores: SubScores): number {
  const weighted =
    subScores.stackFit * HEADLINE_WEIGHTS.stackFit +
    subScores.recencyFit * HEADLINE_WEIGHTS.recencyFit +
    subScores.seniorityFit * HEADLINE_WEIGHTS.seniorityFit +
    subScores.domainOverlap * HEADLINE_WEIGHTS.domainOverlap;
  return Math.round(weighted * 100);
}

function bandFor(headline: number): MatchBand {
  if (headline >= BAND_THRESHOLDS.strong) return "strong";
  if (headline >= BAND_THRESHOLDS.worthApplying) return "worth_applying";
  return "stretch";
}

/**
 * The single entry point PLAN.md's matching pipeline calls: gates first
 * (free, zero spend on a fail), then the deterministic score. The LLM
 * judgment stage (Stage 2 -- domain relevance / career fit / JD subtext on
 * the top ~20/day) reads this explanation's `matched`/`missing` and adds
 * cited labels of its own; it is a Phase 6 follow-up, not built here, and
 * per PLAN.md's third correction it may never emit or alter `headline`.
 */
export function evaluateMatch(input: MatchInput): MatchExplanation {
  const gates = evaluateGates(input.job, input.candidate);
  if (!gates.passed) {
    return {
      headline: 0,
      band: "gated",
      gates,
      subScores: { stackFit: 0, recencyFit: 0, seniorityFit: 0, domainOverlap: 0 },
      matched: [],
      missing: input.job.technologies.map((t) => ({
        technology: t.name,
        necessity: t.necessity,
        quote: t.quote,
        status: "MISSING" as const,
      })),
      scorerVersion: SCORER_VERSION,
    };
  }

  const { subScores, matched, missing } = scoreDeterministic(
    input.job,
    input.candidate,
    input.edges,
  );
  const headline = computeHeadline(subScores);

  return {
    headline,
    band: bandFor(headline),
    gates,
    subScores,
    matched,
    missing,
    scorerVersion: SCORER_VERSION,
  };
}
