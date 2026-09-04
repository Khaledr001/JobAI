import { boolean, date, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { users } from "./identity.js";
import { primaryId, timestamps } from "./_shared.js";

/**
 * Employment history. `endedOn` is deliberately three-state, not a plain
 * nullable date: NULL + endsOpen=true means "still employed here" (a real,
 * confirmed fact); NULL + endsOpen=false means "end date is disputed /
 * unknown" (e.g. the Bizreflex conflict in PLAN.md, where four sources give
 * four different end dates). An importer must never collapse the second
 * case into a guess -- see docs/DECISIONS.md and the `conflicts` table.
 */
export const experiences = pgTable(
  "experiences",
  {
    id: primaryId(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationName: text().notNull(),
    title: text().notNull(),
    location: text(),
    startedOn: date({ mode: "date" }).notNull(),
    endedOn: date({ mode: "date" }),
    endsOpen: boolean().notNull().default(false),
    /** Excluded from the computed years-of-experience total -- e.g. a role under dispute pending conflict resolution. */
    countsTowardTotal: boolean().notNull().default(true),
    ...timestamps(),
  },
  (t) => [index("idx_experiences_owner").on(t.ownerId, t.startedOn.desc())],
);
