import { date, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { users } from "./identity.js";
import { claims } from "./claims.js";
import { evidenceKind } from "./enums.js";
import { primaryId, timestamptz } from "./_shared.js";

/**
 * Append-only, by design in two independent layers: no UPDATE/DELETE grant
 * for jobhunter_app (sql/grants.sql) AND a trigger that raises on either
 * (sql/triggers.sql). A claim's evidence is the reason a resume line is
 * allowed to exist; it must never be quietly edited or removed out from
 * under an already-confirmed claim.
 */
export const evidence = pgTable(
  "evidence",
  {
    id: primaryId(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    claimId: uuid()
      .notNull()
      .references(() => claims.id, { onDelete: "cascade" }),
    kind: evidenceKind().notNull(),
    /** A file path, commit SHA, URL, or ClickUp reference -- whatever locates the artifact. */
    locator: text().notNull(),
    excerpt: text(),
    /** When the underlying artifact is dated (a commit date, a doc's date) -- distinct from addedAt, which is when this row was recorded. */
    occurredOn: date({ mode: "date" }),
    addedAt: timestamptz().notNull().defaultNow(),
  },
  (t) => [
    index("idx_evidence_claim").on(t.claimId),
    index("idx_evidence_owner").on(t.ownerId),
  ],
);
