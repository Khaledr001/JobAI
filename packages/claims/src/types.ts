import { z } from "zod";

/**
 * A single factual assertion a generated document may cite. Phase 1 defines
 * the real, persisted shape in packages/db/src/schema/claims.ts -- this is
 * the pure, IO-free view of it that the validator (and its tests) work
 * against, so the validator never needs a database to run.
 */
export const ClaimSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum([
    "used_technology",
    "held_role",
    "date_range",
    "metric",
    "responsibility",
    "delivered_project",
  ]),
  statement: z.string().min(1),
  /** Every number/date/version token appearing in `statement`, for quantity-containment checks. */
  quantities: z.record(z.string(), z.unknown()).default({}),
  verification: z.enum(["attested", "documented", "corroborated", "measured"]),
  emittable: z.boolean(),
});
export type Claim = z.infer<typeof ClaimSchema>;

export const DocumentSpanSchema = z.object({
  text: z.string().min(1),
  claimIds: z.array(z.string().uuid()),
});
export type DocumentSpan = z.infer<typeof DocumentSpanSchema>;

export const ViolationSchema = z.object({
  code: z.enum([
    "UNCITED_SPAN",
    "DANGLING_CLAIM",
    "UNVERIFIED_CLAIM",
    "QUANTITY_INFLATED",
    "QUANTITY_UNSUPPORTED",
    "VERSION_UNSUPPORTED",
    "UNSUPPORTED_ENTITY",
    "JD_ECHO",
    "SENIORITY_UPGRADE",
    "SUPERLATIVE_UNSUPPORTED",
    "EMPLOYMENT_IMPLICATION",
    "TIMELINE_CONFLICT",
  ]),
  span: z.string(),
  detail: z.string().optional(),
});
export type Violation = z.infer<typeof ViolationSchema>;

export type ValidationResult = { ok: true } | { ok: false; violations: Violation[] };
