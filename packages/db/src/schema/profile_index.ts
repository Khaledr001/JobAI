import { date, integer, numeric, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { users } from "./identity.js";
import { taxonomyNodes } from "./taxonomy.js";
import { verification } from "./enums.js";
import { timestamptz } from "./_shared.js";

/**
 * One row per operator, bumped every time the work-entry ledger changes in
 * a way that should invalidate cached prompts/scores (PLAN.md's AI-layer
 * section: a stable `profile_version` prefix is what makes LLM prompt
 * caching safe). Not yet consumed anywhere in Phase 1 -- packages/llm
 * (Phase 4) is the first real reader -- but it must exist now, because
 * `technology_scores.profileVersion` needs a source of truth to stamp
 * itself with.
 */
export const profileVersions = pgTable("profile_versions", {
  ownerId: uuid()
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  version: integer().notNull().default(1),
  bumpedAt: timestamptz().notNull().defaultNow(),
});

/**
 * The materialized PROJECTION of the work_entries ledger -- see
 * packages/shared-utils/src/projection.ts for the pure scoring function
 * this table stores the output of. Recomputed wholesale on every relevant
 * write (packages/db has no queue infrastructure yet; Phase 4+ can move
 * this to a debounced background job without changing the table shape).
 * Never hand-edited: there is deliberately no API route that writes to this
 * table directly.
 */
export const technologyScores = pgTable(
  "technology_scores",
  {
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    technologyId: uuid()
      .notNull()
      .references(() => taxonomyNodes.id, { onDelete: "cascade" }),
    rawUsageCount: integer().notNull(),
    recencyScore: numeric({ precision: 6, scale: 4 }).notNull(),
    depthScore: numeric({ precision: 6, scale: 4 }).notNull(),
    breadthScore: numeric({ precision: 6, scale: 4 }).notNull(),
    /** The matcher's read path -- everything else here is provenance for the explanation payload. */
    compositeScore: numeric({ precision: 6, scale: 4 }).notNull(),
    firstUsedOn: date({ mode: "date" }).notNull(),
    lastUsedOn: date({ mode: "date" }).notNull(),
    monthsActive: integer().notNull(),
    projectCount: integer().notNull(),
    /** Gates resume emission of this technology, same enum and same rule as claims.verification. */
    verification: verification().notNull(),
    profileVersion: integer().notNull(),
    computedAt: timestamptz().notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.ownerId, t.technologyId] })],
);
