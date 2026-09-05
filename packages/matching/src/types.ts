import type { Verification } from "@jobhunter/shared-types";

/** A resolved technology_scores row -- see packages/shared-utils/projection.ts. */
export interface MyTechnology {
  name: string;
  compositeScore: number;
  recencyScore: number;
  verification: Verification;
}

/** A single edge from packages/db's taxonomy_edges -- only implies/adjacent transfer credit in matching. */
export interface TaxonomyEdgeInput {
  from: string;
  to: string;
  relation: "implies" | "adjacent";
  /** 1.0 for implies (full transfer); a tuned fraction for adjacent (e.g. Drizzle~Prisma 0.6). */
  weight: number;
}

export type Necessity = "required" | "preferred";

export interface RequiredTechnology {
  name: string;
  necessity: Necessity;
  /** Verbatim JD substring -- lets the UI show where a requirement came from (PLAN.md §Parsing). */
  quote: string;
}

export type RemotePolicy = "remote" | "hybrid" | "onsite";

export interface JobRequirements {
  title: string;
  location: string | null;
  remotePolicy: RemotePolicy | null;
  /** True only when the JD explicitly offers visa sponsorship -- absence is not evidence either way, see gates.ts. */
  sponsorshipAvailable: boolean;
  yearsRequired: number | null;
  domains: string[];
  technologies: RequiredTechnology[];
}

export interface CandidateProfile {
  /** Cities/regions/countries the candidate can work onsite/hybrid in without sponsorship. */
  authorizedLocations: string[];
  /** Derived, not typed -- PLAN.md's "Experience" decision: computed from non-overlapping work ranges. */
  experienceYears: number;
  domains: string[];
  technologies: MyTechnology[];
  /** A hard-excluded stack the candidate has pre-decided never to work in again (PLAN.md's Stage A prefilter). */
  excludedTechnologies?: string[];
}

export interface MatchInput {
  job: JobRequirements;
  candidate: CandidateProfile;
  edges: TaxonomyEdgeInput[];
}

export type GateFailureReason = "LOCATION_AUTHORIZATION" | "EXCLUDED_STACK";

export interface GateResult {
  passed: boolean;
  failures: GateFailureReason[];
}

export interface SubScores {
  stackFit: number;
  recencyFit: number;
  seniorityFit: number;
  domainOverlap: number;
}

export interface MatchedTechnology {
  technology: string;
  necessity: Necessity;
  quote: string;
  /** The candidate technology that supplied the credit -- identical to `technology` on an exact match, otherwise the graph-expanded source. */
  via: string;
  score: number;
}

export interface MissingTechnology {
  technology: string;
  necessity: Necessity;
  quote: string;
  status: "MISSING";
}

export type MatchBand = "gated" | "stretch" | "worth_applying" | "strong";

export interface MatchExplanation {
  /** 0-100, bounded by construction (every sub-score is a 0-1 weighted average). Meaningless when `band === "gated"` -- always 0 there. */
  headline: number;
  band: MatchBand;
  gates: GateResult;
  subScores: SubScores;
  matched: MatchedTechnology[];
  missing: MissingTechnology[];
  scorerVersion: string;
}
