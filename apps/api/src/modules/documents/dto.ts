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
export const GeneratedDocumentSchema = z
  .object({
    candidateName: z.string().min(1),
    contactLine: z.string().optional(),
    spans: z.array(GeneratedSpanSchema).min(1),
  })
  .strict();
export type GeneratedDocumentResponse = z.infer<typeof GeneratedDocumentSchema>;
