import { sql } from "drizzle-orm";
import { jsonb, pgTable, text, uuid, index } from "drizzle-orm/pg-core";
import { users } from "./identity.js";
import { claimKind, verification } from "./enums.js";
import { primaryId, timestamptz, timestamps } from "./_shared.js";

/**
 * The atomic assertable unit -- the only thing a generated document is ever
 * allowed to cite. A claim is born unconfirmed (confirmedAt IS NULL) and
 * stays invisible to `v_emittable_claims` until `promote_claim()` (a
 * SECURITY DEFINER function, sql/functions.sql) verifies it has at least
 * one evidence row and sets confirmedAt/confirmedBy. jobhunter_app has no
 * UPDATE grant on verification/confirmedAt/confirmedBy -- see
 * sql/grants.sql. That absence of a grant, not application code, is what
 * makes "promoting a claim with zero evidence fails" true.
 */
export const claims = pgTable(
  "claims",
  {
    id: primaryId(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: claimKind().notNull(),
    /** A short human label, e.g. "NestJS" or "Bizreflex tenure" -- what the conflict/review UI shows. */
    subject: text().notNull(),
    /** The sentence a resume may print, verbatim or near it. */
    statement: text().notNull(),
    /** Every number, date, or version token appearing in `statement` -- what the anti-fabrication validator's quantity-containment pass checks against. */
    quantities: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    verification: verification().notNull().default("attested"),
    confirmedAt: timestamptz(),
    confirmedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    rejectedAt: timestamptz(),
    ...timestamps(),
  },
  (t) => [
    index("idx_claims_owner").on(t.ownerId),
    index("idx_claims_emittable")
      .on(t.ownerId, t.verification)
      .where(sql`${t.rejectedAt} IS NULL`),
  ],
);
