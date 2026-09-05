import { index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { users } from "./identity.js";
import { jobCanonical } from "./jobs.js";
import { documentKind, documentSpanKind } from "./enums.js";
import { primaryId, timestamps, timestamptz } from "./_shared.js";

/**
 * One row per generated document. `generatedAt` is the anchor the
 * `document_spans` citation trigger checks every cited claim against --
 * a claim confirmed *after* this timestamp cannot have legitimised a
 * document that was already generated (sql/04-functions.sql). Bytes live
 * on local disk (`filePathPdf`/`filePathDocx`), not S3/MinIO -- this
 * session has no object storage running; see docs/DECISIONS.md.
 */
export const documents = pgTable(
  "documents",
  {
    id: primaryId(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid().references(() => jobCanonical.id, { onDelete: "set null" }),
    kind: documentKind().notNull(),
    filePathPdf: text().notNull(),
    filePathDocx: text().notNull(),
    model: text().notNull(),
    promptVersion: text().notNull(),
    /** Captured at generation time from `@jobhunter/llm`'s `computeCassetteKey` -- Phase 9's approval snapshot copies this, it never recomputes it later (the underlying claims could have changed by then). */
    cassetteKey: text().notNull(),
    generatedAt: timestamptz().notNull().defaultNow(),
    ...timestamps(),
  },
  (t) => [index("idx_documents_owner").on(t.ownerId, t.generatedAt.desc())],
);

/**
 * Append-only (same two-layer pattern as `evidence`/`job_raw`: no
 * UPDATE/DELETE grant plus a trigger backstop, sql/03-triggers.sql) --
 * once a document is generated, its citations are historical fact, never
 * edited. `claimIds` is a real Postgres array so the citation trigger
 * (sql/04-functions.sql) can loop over it directly; a `bullet` span with
 * zero entries is rejected there, not by a plain CHECK, because the rule
 * also needs the DB round trip to `v_emittable_claims`.
 */
export const documentSpans = pgTable(
  "document_spans",
  {
    id: primaryId(),
    documentId: uuid()
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: documentSpanKind().notNull().default("bullet"),
    text: text().notNull(),
    claimIds: uuid().array().notNull().default([]),
    scopeRef: text(),
    order: integer().notNull(),
    ...timestamps(),
  },
  (t) => [
    index("idx_document_spans_document").on(t.documentId, t.order),
    index("idx_document_spans_owner").on(t.ownerId),
  ],
);
