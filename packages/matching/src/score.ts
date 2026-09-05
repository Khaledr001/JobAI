import { coverageFor } from "./coverage.js";
import type {
  CandidateProfile,
  JobRequirements,
  MatchedTechnology,
  MissingTechnology,
  MyTechnology,
  SubScores,
  TaxonomyEdgeInput,
} from "./types.js";

const REQUIRED_WEIGHT = 1.0;
const PREFERRED_WEIGHT = 0.5;

interface StackResult {
  stackFit: number;
  recencyFit: number;
  matched: MatchedTechnology[];
  missing: MissingTechnology[];
}

/**
 * Stage 1's stack + recency sub-scores, computed together since both are
 * weighted averages over the exact same matched/missing set -- splitting
 * them into two passes would just recompute `coverageFor` twice.
 */
function scoreStack(
  requirements: JobRequirements["technologies"],
  myTechnologies: readonly MyTechnology[],
  edges: readonly TaxonomyEdgeInput[],
): StackResult {
  const matched: MatchedTechnology[] = [];
  const missing: MissingTechnology[] = [];
  let stackWeightedSum = 0;
  let recencyWeightedSum = 0;
  let totalWeight = 0;

  for (const req of requirements) {
    const weight = req.necessity === "required" ? REQUIRED_WEIGHT : PREFERRED_WEIGHT;
    totalWeight += weight;
    const coverage = coverageFor(req.name, myTechnologies, edges);
    stackWeightedSum += weight * coverage.score;

    if (coverage.via) {
      const viaTech = myTechnologies.find((t) => t.name === coverage.via);
      recencyWeightedSum += weight * (viaTech?.recencyScore ?? 0);
      matched.push({
        technology: req.name,
        necessity: req.necessity,
        quote: req.quote,
        via: coverage.via,
        score: coverage.score,
      });
    } else {
      missing.push({
        technology: req.name,
        necessity: req.necessity,
        quote: req.quote,
        status: "MISSING",
      });
    }
  }

  return {
    stackFit: totalWeight === 0 ? 1 : stackWeightedSum / totalWeight,
    recencyFit: totalWeight === 0 ? 1 : recencyWeightedSum / totalWeight,
    matched,
    missing,
  };
}

/**
 * Meets-or-exceeds the stated requirement always scores 1 -- this system
 * has no reason to penalize a candidate for being "overqualified," and a
 * cliff there would be an arbitrary, undocumented opinion. Under the
 * requirement falls off linearly, floored at 0 three years short.
 */
function scoreSeniority(candidateYears: number, requiredYears: number | null): number {
  if (requiredYears === null) return 1;
  const diff = candidateYears - requiredYears;
  if (diff >= 0) return 1;
  return Math.max(0, 1 + diff / 3);
}

function scoreDomainOverlap(
  candidateDomains: readonly string[],
  jobDomains: readonly string[],
): number {
  if (jobDomains.length === 0) return 1;
  const norm = (s: string) => s.trim().toLowerCase();
  const candidateSet = new Set(candidateDomains.map(norm));
  const overlap = jobDomains.filter((d) => candidateSet.has(norm(d))).length;
  return overlap / jobDomains.length;
}

export interface DeterministicScoreResult {
  subScores: SubScores;
  matched: MatchedTechnology[];
  missing: MissingTechnology[];
}

/**
 * Stage 1 (PLAN.md §Matching engine): free, reproducible, no LLM call.
 * Sub-scores survive to the caller rather than being blended here -- a
 * single number destroys the explanation, which is the actual product
 * (PLAN.md's second correction to the original design).
 */
export function scoreDeterministic(
  job: JobRequirements,
  candidate: CandidateProfile,
  edges: readonly TaxonomyEdgeInput[],
): DeterministicScoreResult {
  const stack = scoreStack(job.technologies, candidate.technologies, edges);
  const subScores: SubScores = {
    stackFit: stack.stackFit,
    recencyFit: stack.recencyFit,
    seniorityFit: scoreSeniority(candidate.experienceYears, job.yearsRequired),
    domainOverlap: scoreDomainOverlap(candidate.domains, job.domains),
  };
  return { subScores, matched: stack.matched, missing: stack.missing };
}
