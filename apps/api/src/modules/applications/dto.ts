import { ApplicationStatusSchema } from "@jobhunter/shared-types";
import { z } from "zod";

export const CreateApplicationSchema = z.object({
  jobId: z.string().uuid(),
});
export type CreateApplicationDto = z.infer<typeof CreateApplicationSchema>;

export const TransitionApplicationSchema = z.object({
  status: ApplicationStatusSchema,
  /** Required (and validated against this application's own job) only when transitioning to "drafted". */
  documentId: z.string().uuid().optional(),
  note: z.string().min(1).max(1000).optional(),
});
export type TransitionApplicationDto = z.infer<typeof TransitionApplicationSchema>;
