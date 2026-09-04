import { date, index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./identity.js";
import { projectEpochs, projects } from "./projects.js";
import { taxonomyNodes } from "./taxonomy.js";
import { evidenceKind, techTagRole, workEntryType } from "./enums.js";
import { primaryId, timestamps, timestamptz } from "./_shared.js";

/**
 * Append-only ledger -- this is the source of truth "My Work" is built on.
 * Nothing here is ever hand-edited into staleness the way a static
 * `proficiency` field would be; `technology_scores` (profile_index.ts) is
 * recomputed FROM this table, never the other way around. Never DELETE a
 * row: use `retractedAt` (see rls.sql / grants.sql -- the app role has no
 * DELETE grant on this table either).
 */
export const workEntries = pgTable(
  "work_entries",
  {
    id: primaryId(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid().references(() => projects.id, { onDelete: "set null" }),
    epochId: uuid().references(() => projectEpochs.id, { onDelete: "set null" }),
    title: text().notNull(),
    body: text().notNull(),
    /** The "Result:" field from the Add Work form. */
    outcome: text(),
    type: workEntryType().notNull(),
    /** When the work happened -- NOT createdAt, which is when it was logged. */
    occurredOn: date({ mode: "date" }).notNull(),
    /** For entries imported from a dated range (e.g. a project-phase document). */
    occurredThrough: date({ mode: "date" }),
    /** Set when this entry traces to a concrete artifact (a commit, a doc section) rather than being typed by hand. */
    sourceKind: evidenceKind(),
    sourceRef: text(),
    /** sha256 of the normalized body -- both the human dedupe key and (later) the LLM-extraction cache key. */
    contentHash: text().notNull(),
    retractedAt: timestamptz(),
    ...timestamps(),
  },
  (t) => [
    index("idx_work_entries_owner_occurred").on(t.ownerId, t.occurredOn.desc()),
    uniqueIndex("uq_work_entries_owner_hash").on(t.ownerId, t.contentHash),
  ],
);

/**
 * Which technologies a work entry demonstrates, and how centrally. This is
 * what `computeTechnologyScore` (packages/shared-utils) folds over to
 * produce `technology_scores` -- a manual tag today, an LLM-extraction
 * proposal once packages/llm exists (Phase 4), same table either way.
 */
export const workEntryTechnologies = pgTable(
  "work_entry_technologies",
  {
    id: primaryId(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workEntryId: uuid()
      .notNull()
      .references(() => workEntries.id, { onDelete: "cascade" }),
    technologyId: uuid()
      .notNull()
      .references(() => taxonomyNodes.id, { onDelete: "restrict" }),
    role: techTagRole().notNull().default("primary"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("uq_work_entry_technologies").on(t.workEntryId, t.technologyId),
    index("idx_work_entry_technologies_tech").on(t.technologyId),
  ],
);
