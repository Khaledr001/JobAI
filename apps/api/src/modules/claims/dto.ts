import {
  CLAIM_KINDS,
  EVIDENCE_KINDS,
  VERIFICATION_LEVELS,
} from "@jobhunter/shared-types";
import { z } from "zod";

export const CreateClaimSchema = z.object({
  kind: z.enum(CLAIM_KINDS),
  subject: z.string().min(1).max(200),
  statement: z.string().min(1).max(1000),
  quantities: z.record(z.string(), z.unknown()).default({}),
});
export type CreateClaimDto = z.infer<typeof CreateClaimSchema>;

export const AttachEvidenceSchema = z.object({
  kind: z.enum(EVIDENCE_KINDS),
  locator: z.string().min(1).max(2000),
  excerpt: z.string().max(2000).optional(),
  occurredOn: z.coerce.date().optional(),
});
export type AttachEvidenceDto = z.infer<typeof AttachEvidenceSchema>;

export const ConfirmClaimSchema = z.object({
  verification: z.enum(VERIFICATION_LEVELS),
});
export type ConfirmClaimDto = z.infer<typeof ConfirmClaimSchema>;
