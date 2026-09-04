import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  ClaimSchema,
  DocumentSpanSchema,
  PASS_NAMES,
  ViolationCodeSchema,
} from "./types.js";

/**
 * NOT exported from index.ts -- this is test/verification infrastructure
 * (loading recorded fixture files from disk), not part of the pure
 * validate() decision surface. Kept in this package because it's the
 * schema-aware counterpart to `types.ts`, shared by
 * `validator.spec.ts` and `scripts/verify-no-fabrication.mjs` so the
 * fixture format is defined exactly once.
 */
export const AdversarialFixtureSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  /** Which of the seven passes this fixture exercises -- null only for the one honest, passing fixture. */
  pass: z.enum(PASS_NAMES).nullable(),
  /** The violation code `validate()` must return among its violations -- null only for the honest fixture. */
  expectedCode: ViolationCodeSchema.nullable(),
  jobDescription: z.string().nullable().default(null),
  claims: z.array(ClaimSchema),
  spans: z.array(DocumentSpanSchema),
});
export type AdversarialFixture = z.infer<typeof AdversarialFixtureSchema>;

export function loadAdversarialFixtures(dir: string): AdversarialFixture[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) =>
      AdversarialFixtureSchema.parse(JSON.parse(readFileSync(join(dir, f), "utf8"))),
    );
}
