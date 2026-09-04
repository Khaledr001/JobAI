import type { TechTagRole, Verification, WorkEntryType } from "@jobhunter/shared-types";
import { monthsBetween } from "./dates.js";
import { recencyWeight, WORK_ENTRY_TYPE_DEPTH } from "./recency.js";

/**
 * Mirrors the weights extraction proposals use for a work entry's relation
 * to a technology it tags. `incidental` deliberately equals `learning`'s
 * type-depth weight (0.15) -- a passing mention counts about as little as a
 * tutorial, and neither alone should promote a technology to emittable.
 */
export const TECH_TAG_ROLE_WEIGHT: Record<TechTagRole, number> = {
  primary: 1.0,
  supporting: 0.5,
  incidental: 0.15,
};

/** Projects with 3+ distinct touches are treated as maximally broad -- an arbitrary but documented saturation point. */
const BREADTH_SATURATION_PROJECTS = 3;

export interface TechUsageEntry {
  occurredOn: Date;
  workEntryType: WorkEntryType;
  tagRole: TechTagRole;
  /** True when the work entry itself carries a sourceKind/sourceRef (a commit, a doc, a log line) -- i.e. it is not a bare self-report. */
  hasSourceEvidence: boolean;
  projectId: string | null;
}

export interface TechnologyScore {
  rawUsageCount: number;
  recencyScore: number;
  depthScore: number;
  breadthScore: number;
  compositeScore: number;
  firstUsedOn: Date;
  lastUsedOn: Date;
  monthsActive: number;
  projectCount: number;
  verification: Verification;
}

/**
 * Recomputed from the work-entry ledger on every write (packages/db's
 * projection job) -- never hand-typed, so it can't rot the way a static
 * `proficiency` field would. Pure and deterministic: `asOf` is passed in
 * rather than read from the clock, so this is golden-file testable.
 */
export function computeTechnologyScore(
  entries: readonly TechUsageEntry[],
  asOf: Date,
): TechnologyScore {
  if (entries.length === 0) {
    throw new Error("computeTechnologyScore: entries must be non-empty");
  }

  const weight = (e: TechUsageEntry) =>
    WORK_ENTRY_TYPE_DEPTH[e.workEntryType] * TECH_TAG_ROLE_WEIGHT[e.tagRole];
  const totalWeight = entries.reduce((sum, e) => sum + weight(e), 0);

  const depthScore = totalWeight / entries.length;

  const recencyScore =
    totalWeight === 0
      ? 0
      : entries.reduce((sum, e) => {
          const monthsAgo = monthsBetween(e.occurredOn, asOf);
          return sum + weight(e) * recencyWeight(monthsAgo);
        }, 0) / totalWeight;

  const distinctProjects = new Set(
    entries.map((e) => e.projectId).filter((id): id is string => id !== null),
  );
  const breadthScore = Math.min(1, distinctProjects.size / BREADTH_SATURATION_PROJECTS);

  const compositeScore = recencyScore * 0.5 + depthScore * 0.3 + breadthScore * 0.2;

  const dates = entries.map((e) => e.occurredOn.getTime());
  const firstUsedOn = new Date(Math.min(...dates));
  const lastUsedOn = new Date(Math.max(...dates));

  // learning-only usage, with no supporting evidence, never clears "attested" --
  // reading about a technology cannot promote it to a resume-emittable claim.
  const isLearningOnly = entries.every((e) => e.workEntryType === "learning");
  const hasEvidence = entries.some((e) => e.hasSourceEvidence);
  const verification: Verification =
    hasEvidence && !isLearningOnly ? "documented" : "attested";

  return {
    rawUsageCount: entries.length,
    recencyScore,
    depthScore,
    breadthScore,
    compositeScore,
    firstUsedOn,
    lastUsedOn,
    monthsActive: monthsBetween(firstUsedOn, lastUsedOn),
    projectCount: distinctProjects.size,
    verification,
  };
}
