import { z } from "zod";

export const AnalyzeGapSchema = z.object({
  jobDescription: z.string().min(50).max(20000),
});
export type AnalyzeGapDto = z.infer<typeof AnalyzeGapSchema>;

const MatchedTechnologySchema = z.object({
  technology: z.string().min(1),
  jdQuote: z.string().min(1),
  claimSubject: z.string().min(1),
});

const MissingTechnologySchema = z.object({
  technology: z.string().min(1),
  jdQuote: z.string().min(1),
  necessity: z.enum(["required", "preferred"]),
});

/**
 * `.strict()`: an unexpected key means the prompt and this schema have
 * drifted, and that should be loud rather than silently dropped (D-series
 * precedent from `packages/claims`' extraction schemas).
 */
export const GapAnalysisResultSchema = z
  .object({
    matched: z.array(MatchedTechnologySchema),
    missing: z.array(MissingTechnologySchema),
    summary: z.string().min(1).max(2000),
  })
  .strict();
export type GapAnalysisResult = z.infer<typeof GapAnalysisResultSchema>;
