import { DocumentKindSchema } from "@jobhunter/shared-types";
import { z } from "zod";

export const GenerateDocumentSchema = z.object({
  jobId: z.string().uuid(),
  kind: DocumentKindSchema.default("resume"),
});
export type GenerateDocumentDto = z.infer<typeof GenerateDocumentSchema>;

const GeneratedSpanSchema = z.object({
  kind: z.enum(["summary", "bullet"]),
  text: z.string().min(1),
  claimIds: z.array(z.string().uuid()).default([]),
  scopeRef: z.string().optional(),
});

/**
 * The LLM's raw output shape -- `.strict()` since an unexpected key means
 * the prompt and this schema have drifted (same discipline as
 * gap-analysis's response schema). This is deliberately flatter than
 * `@jobhunter/resume-render`'s `ResumeDocument` (no section headings from
 * the model) -- the generator owns section grouping, not the LLM.
 */
/**
 * Spans only. The candidate's name and contact line are NOT asked of the
 * model: they are known facts on the `users`/`profiles` rows, and `persist()`
 * reads them from there. Requiring them here was a real bug -- `draft()`
 * destructured `spans` and threw `candidateName` away, so the model was
 * forced to produce a value nothing consumed. Worse, the prompt never tells
 * it the operator's name, so the only ways to satisfy the field were to
 * invent one or return "". A live `deepseek-v4-pro` call did the honest
 * thing, returned "", and the whole generation failed on `min(1)`.
 * Identity belongs to the database; the model's job is the prose.
 */
export const GeneratedDocumentSchema = z
  .object({
    spans: z.array(GeneratedSpanSchema).min(1),
  })
  .strict();
export type GeneratedDocumentResponse = z.infer<typeof GeneratedDocumentSchema>;
