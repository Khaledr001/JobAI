import { z } from "zod";
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
} from "./enum-values.js";

/**
 * Zod schemas over the shared enum values. Everything in
 * `./enum-values.js` is re-exported here, so importing the package
 * root still gets arrays, types, and schemas exactly as before.
 */
export * from "./enum-values.js";

export const WorkEntryTypeSchema = z.enum(WORK_ENTRY_TYPES);
export const VerificationSchema = z.enum(VERIFICATION_LEVELS);
export const EvidenceKindSchema = z.enum(EVIDENCE_KINDS);
export const ClaimKindSchema = z.enum(CLAIM_KINDS);
export const ConflictKindSchema = z.enum(CONFLICT_KINDS);
export const ConflictStatusSchema = z.enum(CONFLICT_STATUSES);
export const ProjectStatusSchema = z.enum(PROJECT_STATUSES);
export const TaxonomyNodeKindSchema = z.enum(TAXONOMY_NODE_KINDS);
export const TaxonomyReviewStatusSchema = z.enum(TAXONOMY_REVIEW_STATUSES);
export const TaxonomyEdgeRelationSchema = z.enum(TAXONOMY_EDGE_RELATIONS);
export const TechTagRoleSchema = z.enum(TECH_TAG_ROLES);
export const JobSourceProviderSchema = z.enum(JOB_SOURCE_PROVIDERS);
export const DocumentKindSchema = z.enum(DOCUMENT_KINDS);
export const DocumentSpanKindSchema = z.enum(DOCUMENT_SPAN_KINDS);
export const ApplicationStatusSchema = z.enum(APPLICATION_STATUSES);
