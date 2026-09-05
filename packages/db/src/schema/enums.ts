import {
  APPLICATION_STATUSES,
  CLAIM_KINDS,
  CONFLICT_KINDS,
  CONFLICT_STATUSES,
  DOCUMENT_KINDS,
  DOCUMENT_SPAN_KINDS,
  EVIDENCE_KINDS,
  JOB_SOURCE_PROVIDERS,
  PROJECT_STATUSES,
  TAXONOMY_EDGE_RELATIONS,
  TAXONOMY_NODE_KINDS,
  TAXONOMY_REVIEW_STATUSES,
  TECH_TAG_ROLES,
  VERIFICATION_LEVELS,
  WORK_ENTRY_TYPES,
} from "@jobhunter/shared-types";
import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Every pgEnum's value list is imported from @jobhunter/shared-types rather
 * than retyped here -- one array feeds the Postgres enum, the Zod schema
 * used at the API boundary, and the TS union. Drift between "what the DB
 * accepts" and "what the API validates" is a class of bug this structurally
 * prevents.
 */
export const workEntryType = pgEnum("work_entry_type", WORK_ENTRY_TYPES);

/** Declaration order is the comparison order v_emittable_claims uses (verification >= 'documented'). */
export const verification = pgEnum("verification", VERIFICATION_LEVELS);

export const evidenceKind = pgEnum("evidence_kind", EVIDENCE_KINDS);
export const claimKind = pgEnum("claim_kind", CLAIM_KINDS);
export const conflictKind = pgEnum("conflict_kind", CONFLICT_KINDS);
export const conflictStatus = pgEnum("conflict_status", CONFLICT_STATUSES);
export const projectStatus = pgEnum("project_status", PROJECT_STATUSES);
export const taxonomyNodeKind = pgEnum("taxonomy_node_kind", TAXONOMY_NODE_KINDS);
export const taxonomyReviewStatus = pgEnum(
  "taxonomy_review_status",
  TAXONOMY_REVIEW_STATUSES,
);
export const taxonomyEdgeRelation = pgEnum(
  "taxonomy_edge_relation",
  TAXONOMY_EDGE_RELATIONS,
);
export const techTagRole = pgEnum("tech_tag_role", TECH_TAG_ROLES);
export const jobSourceProvider = pgEnum("job_source_provider", JOB_SOURCE_PROVIDERS);
export const documentKind = pgEnum("document_kind", DOCUMENT_KINDS);
export const documentSpanKind = pgEnum("document_span_kind", DOCUMENT_SPAN_KINDS);
export const applicationStatus = pgEnum("application_status", APPLICATION_STATUSES);
