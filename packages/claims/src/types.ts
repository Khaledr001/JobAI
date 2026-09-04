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
  /** A short label, e.g. "NestJS" or "Bizreflex" -- what entity-closure and employment-implication match against. */
  subject: z.string().min(1),
  /** The sentence a resume may print, verbatim or near it. */
  statement: z.string().min(1),
  /**
   * Every number, date, ordinal level, or version token the statement is
   * allowed to support, e.g. `{ years: 2 }`, `{ percent: 30 }`,
   * `{ "proficiency:French": "conversational" }`, `{ "version:React": "17" }`,
   * `{ seniority: "led" }`, `{ from: "2024-01-01", to: "2025-06-01" }`.
   */
  quantities: z.record(z.string(), z.unknown()).default({}),
  verification: z.enum(["attested", "documented", "corroborated", "measured"]),
  emittable: z.boolean(),
  /**
   * Which resume entry (an experience or project id) this claim belongs to.
   * Unscoped (undefined) for general, entry-independent claims (e.g. a bare
   * skill). Used only by citation-resolution's CLAIM_SUBJECT_MISMATCH check.
   */
  scopeRef: z.string().optional(),
});
export type Claim = z.infer<typeof ClaimSchema>;

export const DocumentSpanSchema = z.object({
  text: z.string().min(1),
  /**
   * "summary" spans (an objective/profile line) may mention a technology the
   * job description wants without citing it -- they assert no past
   * experience. "bullet" spans (an experience/project line) always assert
   * experience and must cite everything checkable; the JD is never consulted
   * for them. Defaults to "bullet", the stricter case.
   */
  kind: z.enum(["summary", "bullet"]).default("bullet"),
  claimIds: z.array(z.string().uuid()).default([]),
  /** Which resume entry this span is rendered under -- must match cited claims' scopeRef, when both are set. */
  scopeRef: z.string().optional(),
});
export type DocumentSpan = z.infer<typeof DocumentSpanSchema>;

export const ViolationCodeSchema = z.enum([
  "UNCITED_SPAN",
  "DANGLING_CLAIM",
  "UNVERIFIED_CLAIM",
  "CLAIM_SUBJECT_MISMATCH",
  "QUANTITY_INFLATED",
  "QUANTITY_UNSUPPORTED",
  "VERSION_UNSUPPORTED",
  "UNSUPPORTED_ENTITY",
  "JD_ECHO",
  "SENIORITY_UPGRADE",
  "SUPERLATIVE_UNSUPPORTED",
  "EMPLOYMENT_IMPLICATION",
  "TIMELINE_CONFLICT",
]);
export type ViolationCode = z.infer<typeof ViolationCodeSchema>;

export const ViolationSchema = z.object({
  code: ViolationCodeSchema,
  span: z.string(),
  detail: z.string().optional(),
});
export type Violation = z.infer<typeof ViolationSchema>;

export type ValidationResult = { ok: true } | { ok: false; violations: Violation[] };

/**
 * The seven passes, named for the mutation harness
 * (`scripts/verify-validator-mutations.mjs`): it disables each in turn and
 * asserts at least one adversarial fixture flips from rejected to accepted,
 * proving the pass is load-bearing rather than dead code shadowed by
 * another pass.
 */
export const PASS_NAMES = [
  "citationCompleteness",
  "citationResolution",
  "quantityContainment",
  "entityClosure",
  "seniorityLexicon",
  "employmentImplication",
  "timelineCoherence",
] as const;
export type PassName = (typeof PASS_NAMES)[number];

export interface ValidateOptions {
  /** Untrusted input (see docs/PATTERNS.md) -- only ever relaxes entity-closure for "summary" spans, never for "bullet" spans. */
  jobDescription?: string;
  /** Test-only: disables one or more passes to prove each is load-bearing. Never set outside the mutation harness. */
  disabledPasses?: readonly PassName[];
}
