import type { CandidateProfile, GateResult, JobRequirements } from "./types.js";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Stage 0 (PLAN.md §Matching engine): free, deterministic, and runs before
 * any scoring or LLM spend. A perfect stack match in a location the
 * candidate cannot legally work in without sponsorship is not "90%" -- it
 * is a zero, and a blended score would hide that entirely. This is the
 * fix for the original design's "location and authorization as 10% of a
 * blended number."
 */
export function evaluateGates(
  job: JobRequirements,
  candidate: CandidateProfile,
): GateResult {
  const failures: GateResult["failures"] = [];

  if (job.remotePolicy !== "remote") {
    const authorized =
      job.location === null ||
      job.sponsorshipAvailable ||
      candidate.authorizedLocations.some(
        (loc) =>
          normalize(job.location!).includes(normalize(loc)) ||
          normalize(loc).includes(normalize(job.location!)),
      );
    if (!authorized) {
      failures.push("LOCATION_AUTHORIZATION");
    }
  }

  const excluded = new Set((candidate.excludedTechnologies ?? []).map(normalize));
  const requiresExcluded = job.technologies.some(
    (t) => t.necessity === "required" && excluded.has(normalize(t.name)),
  );
  if (requiresExcluded) {
    failures.push("EXCLUDED_STACK");
  }

  return { passed: failures.length === 0, failures };
}
