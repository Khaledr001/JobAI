import {
  EVIDENCE_KINDS,
  TECH_TAG_ROLES,
  WORK_ENTRY_TYPES,
} from "@jobhunter/shared-types";
import { z } from "zod";

const TechnologyTagSchema = z.object({
  technologyId: z.string().uuid(),
  role: z.enum(TECH_TAG_ROLES).default("primary"),
});

export const CreateWorkEntrySchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
  outcome: z.string().max(1000).optional(),
  type: z.enum(WORK_ENTRY_TYPES),
  occurredOn: z.coerce.date(),
  occurredThrough: z.coerce.date().optional(),
  projectId: z.string().uuid().optional(),
  epochId: z.string().uuid().optional(),
  // Set together: an entry traceable to a concrete artifact (a commit, a
  // doc section) rather than typed by hand. This is what
  // ProjectionService reads as `hasSourceEvidence` -- without it, a
  // technology tagged on this entry can never clear "attested".
  sourceKind: z.enum(EVIDENCE_KINDS).optional(),
  sourceRef: z.string().min(1).max(2000).optional(),
  technologies: z.array(TechnologyTagSchema).max(24).default([]),
});
export type CreateWorkEntryDto = z.infer<typeof CreateWorkEntrySchema>;
