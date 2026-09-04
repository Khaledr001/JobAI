import { z } from "zod";

/**
 * Feeds a pgEnum, a z.enum, and the TS union from one array — see
 * packages/db for the pgEnum side of this pattern.
 */
function asConst<const T extends readonly [string, ...string[]]>(values: T): T {
  return values;
}

export const WORK_ENTRY_TYPES = asConst([
  "feature",
  "fix",
  "refactor",
  "architecture",
  "performance",
  "infra",
  "integration",
  "security",
  "docs",
  "learning",
  "release",
]);
export const WorkEntryTypeSchema = z.enum(WORK_ENTRY_TYPES);
export type WorkEntryType = z.infer<typeof WorkEntryTypeSchema>;

export const VERIFICATION_LEVELS = asConst([
  "attested",
  "documented",
  "corroborated",
  "measured",
]);
export const VerificationSchema = z.enum(VERIFICATION_LEVELS);
export type Verification = z.infer<typeof VerificationSchema>;
