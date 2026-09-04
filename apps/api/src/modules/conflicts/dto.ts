import { z } from "zod";

export const ResolveConflictSchema = z.object({
  status: z.enum(["resolved", "accepted_both", "wont_fix"]),
  resolutionNote: z.string().min(1).max(1000).optional(),
});
export type ResolveConflictDto = z.infer<typeof ResolveConflictSchema>;
