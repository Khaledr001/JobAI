import { z } from "zod";

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
export const WorkEntryTypeSchema = z.enum(WORK_ENTRY_TYPES);
export type WorkEntryType = z.infer<typeof WorkEntryTypeSchema>;

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
export const VerificationSchema = z.enum(VERIFICATION_LEVELS);
export type Verification = z.infer<typeof VerificationSchema>;

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
export const EvidenceKindSchema = z.enum(EVIDENCE_KINDS);
export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;

export const CLAIM_KINDS = asConst([
  "used_technology",
  "held_role",
  "date_range",
  "metric",
  "responsibility",
  "delivered_project",
]);
export const ClaimKindSchema = z.enum(CLAIM_KINDS);
export type ClaimKind = z.infer<typeof ClaimKindSchema>;

export const CONFLICT_KINDS = asConst([
  "tech_stack",
  "count",
  "metric_value",
  "date_range",
  "coverage_gap",
  "duplicate_entity",
  "definition",
]);
export const ConflictKindSchema = z.enum(CONFLICT_KINDS);
export type ConflictKind = z.infer<typeof ConflictKindSchema>;

export const CONFLICT_STATUSES = asConst([
  "open",
  "resolved",
  "accepted_both",
  "wont_fix",
]);
export const ConflictStatusSchema = z.enum(CONFLICT_STATUSES);
export type ConflictStatus = z.infer<typeof ConflictStatusSchema>;

export const PROJECT_STATUSES = asConst(["active", "shipped", "archived"]);
export const ProjectStatusSchema = z.enum(PROJECT_STATUSES);
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const TAXONOMY_NODE_KINDS = asConst(["technology", "skill", "concept", "domain"]);
export const TaxonomyNodeKindSchema = z.enum(TAXONOMY_NODE_KINDS);
export type TaxonomyNodeKind = z.infer<typeof TaxonomyNodeKindSchema>;

export const TAXONOMY_REVIEW_STATUSES = asConst(["proposed", "canonical", "rejected"]);
export const TaxonomyReviewStatusSchema = z.enum(TAXONOMY_REVIEW_STATUSES);
export type TaxonomyReviewStatus = z.infer<typeof TaxonomyReviewStatusSchema>;

export const TAXONOMY_EDGE_RELATIONS = asConst([
  "implies",
  "broader_than",
  "adjacent",
  "requires",
  "used_with",
  "belongs_to_domain",
]);
export const TaxonomyEdgeRelationSchema = z.enum(TAXONOMY_EDGE_RELATIONS);
export type TaxonomyEdgeRelation = z.infer<typeof TaxonomyEdgeRelationSchema>;

/**
 * The role a work entry plays in establishing a technology's usage —
 * mirrors `WORK_ENTRY_TYPE_DEPTH`'s intent but at the tag level: an entry
 * can be a `primary` driver of a technology or merely `incidental` to it.
 */
export const TECH_TAG_ROLES = asConst(["primary", "supporting", "incidental"]);
export const TechTagRoleSchema = z.enum(TECH_TAG_ROLES);
export type TechTagRole = z.infer<typeof TechTagRoleSchema>;

/**
 * Tier-1 public ATS JSON APIs only (PLAN.md §Job ingestion) -- no auth, no
 * ToS conflict. Adzuna/free feeds (tier 2) and assisted browser sources
 * (tier 3, D6) are added to this list only when their adapters land.
 */
export const JOB_SOURCE_PROVIDERS = asConst(["greenhouse", "lever"]);
export const JobSourceProviderSchema = z.enum(JOB_SOURCE_PROVIDERS);
export type JobSourceProvider = z.infer<typeof JobSourceProviderSchema>;

export const DOCUMENT_KINDS = asConst(["resume", "cover_letter"]);
export const DocumentKindSchema = z.enum(DOCUMENT_KINDS);
export type DocumentKind = z.infer<typeof DocumentKindSchema>;

/** Must match packages/claims' `DocumentSpanSchema.kind` exactly -- both describe the same span. */
export const DOCUMENT_SPAN_KINDS = asConst(["summary", "bullet"]);
export const DocumentSpanKindSchema = z.enum(DOCUMENT_SPAN_KINDS);
export type DocumentSpanKind = z.infer<typeof DocumentSpanKindSchema>;

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
export const ApplicationStatusSchema = z.enum(APPLICATION_STATUSES);
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;
