import { index, integer, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { users } from "./identity.js";
import { primaryId, timestamptz } from "./_shared.js";

/**
 * Append-only cost ledger -- every LLM call, real or replayed, gets a row.
 * `packages/llm`'s `BudgetGuard` is handed "spent today" as a plain number
 * (it stays transport-only, no DB dependency); this table is what the
 * caller sums to produce that number, per docs/PATTERNS.md.
 *
 * `estimatedCostUsd` is `numeric(12,6)`, not the `Money` type used
 * elsewhere: a single call costs thousandths of a cent and would render as
 * "0.0000" at Money's 4dp. Same documented exception PLAN.md notes for
 * `extraction_runs.estimatedCostUsd`.
 */
export const llmCalls = pgTable(
  "llm_calls",
  {
    id: primaryId(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text().notNull(),
    model: text().notNull(),
    /** Which feature made the call, e.g. "gap-analysis" -- lets cost be broken down per feature later. */
    feature: text().notNull(),
    promptTokens: integer().notNull(),
    completionTokens: integer().notNull(),
    cacheHitTokens: integer().notNull(),
    cacheMissTokens: integer().notNull(),
    estimatedCostUsd: numeric({ precision: 12, scale: 6 }).notNull(),
    latencyMs: integer(),
    /** "live" | "record" | "replay" -- audit trail of which calls were real vs. replayed in a test run. */
    cassetteMode: text().notNull(),
    createdAt: timestamptz().notNull().defaultNow(),
  },
  (t) => [index("idx_llm_calls_owner_created").on(t.ownerId, t.createdAt.desc())],
);
