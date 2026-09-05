/**
 * The enum *values* -- plain arrays and the TS unions derived from them,
 * with no `zod` import anywhere in the module graph.
 *
 * Split out of `enums.ts` so a browser bundle can name these constants
 * (a <select> over WORK_ENTRY_TYPES, say) without pulling zod's runtime
 * into the client: importing the combined module cost apps/web 367 KiB of
 * uncompressed JS for three string arrays. Import this module directly via
 * `@jobhunter/shared-types/values` from anything that ships to a browser;
 * server code can keep importing the package root, which re-exports all of
 * it alongside the schemas.
 */
/**
 * Feeds a pgEnum, a z.enum, and the TS union from one array — see
 * packages/db for the pgEnum side of this pattern.
 */
function asConst<const T extends readonly [string, ...string[]]>(values: T): T {
  return values;
}

export const WORK_ENTRY_TYPES = asConst([
  "feature",
  "fix",
  "refactor",
  "architecture",
  "performance",
  "infra",
  "integration",
  "security",
  "docs",
  "learning",
  "release",
]);
export type WorkEntryType = (typeof WORK_ENTRY_TYPES)[number];

/**
 * Declaration order is the comparison order `v_emittable_claims` uses
 * (`verification >= 'documented'`) — do not reorder without updating that
 * view's SQL.
 */
export const VERIFICATION_LEVELS = asConst([
  "attested",
  "documented",
  "corroborated",
  "measured",
]);
export type Verification = (typeof VERIFICATION_LEVELS)[number];

export const EVIDENCE_KINDS = asConst([
  "git_commit",
  "git_file_presence",
  "dependency_manifest",
  "log_line",
  "doc_section",
  "live_url",
  "employer_reference",
  "certificate",
  "attestation",
]);
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const CLAIM_KINDS = asConst([
  "used_technology",
  "held_role",
  "date_range",
  "metric",
  "responsibility",
  "delivered_project",
]);
export type ClaimKind = (typeof CLAIM_KINDS)[number];

export const CONFLICT_KINDS = asConst([
  "tech_stack",
  "count",
  "metric_value",
  "date_range",
  "coverage_gap",
  "duplicate_entity",
  "definition",
]);
export type ConflictKind = (typeof CONFLICT_KINDS)[number];

export const CONFLICT_STATUSES = asConst([
  "open",
  "resolved",
  "accepted_both",
  "wont_fix",
]);
export type ConflictStatus = (typeof CONFLICT_STATUSES)[number];

export const PROJECT_STATUSES = asConst(["active", "shipped", "archived"]);
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const TAXONOMY_NODE_KINDS = asConst(["technology", "skill", "concept", "domain"]);
export type TaxonomyNodeKind = (typeof TAXONOMY_NODE_KINDS)[number];

export const TAXONOMY_REVIEW_STATUSES = asConst(["proposed", "canonical", "rejected"]);
export type TaxonomyReviewStatus = (typeof TAXONOMY_REVIEW_STATUSES)[number];

export const TAXONOMY_EDGE_RELATIONS = asConst([
  "implies",
  "broader_than",
  "adjacent",
  "requires",
  "used_with",
  "belongs_to_domain",
]);
export type TaxonomyEdgeRelation = (typeof TAXONOMY_EDGE_RELATIONS)[number];

/**
 * The role a work entry plays in establishing a technology's usage —
 * mirrors `WORK_ENTRY_TYPE_DEPTH`'s intent but at the tag level: an entry
 * can be a `primary` driver of a technology or merely `incidental` to it.
 */
export const TECH_TAG_ROLES = asConst(["primary", "supporting", "incidental"]);
export type TechTagRole = (typeof TECH_TAG_ROLES)[number];

/**
 * Tier-1 public ATS JSON APIs only (PLAN.md §Job ingestion) -- no auth, no
 * ToS conflict. Adzuna/free feeds (tier 2) and assisted browser sources
 * (tier 3, D6) are added to this list only when their adapters land.
 */
export const JOB_SOURCE_PROVIDERS = asConst(["greenhouse", "lever"]);
export type JobSourceProvider = (typeof JOB_SOURCE_PROVIDERS)[number];

export const DOCUMENT_KINDS = asConst(["resume", "cover_letter"]);
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** Must match packages/claims' `DocumentSpanSchema.kind` exactly -- both describe the same span. */
export const DOCUMENT_SPAN_KINDS = asConst(["summary", "bullet"]);
export type DocumentSpanKind = (typeof DOCUMENT_SPAN_KINDS)[number];

/**
 * PLAN.md's state machine. `approved` is the one transition that freezes
 * an immutable snapshot (packages/db/src/schema/applications.ts); `offer`,
 * `rejected`, and `ghosted` are terminal -- see `APPLICATION_TRANSITIONS`
 * in that same file for exactly which transitions between these are legal.
 */
export const APPLICATION_STATUSES = asConst([
  "discovered",
  "matched",
  "drafted",
  "approved",
  "applied",
  "replied",
  "interviewing",
  "offer",
  "rejected",
  "ghosted",
]);
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
