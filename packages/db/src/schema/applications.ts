import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./identity.js";
import { jobCanonical } from "./jobs.js";
import { documents } from "./documents.js";
import { applicationStatus } from "./enums.js";
import { primaryId, timestamps, timestamptz } from "./_shared.js";

/**
 * PLAN.md's state machine -- one row per (owner, job). `status` is a
 * normal mutable column (unlike the append-only ledgers elsewhere in this
 * schema): a real state machine needs updates, but only LEGAL ones -- see
 * `applications_validate_transition` (sql/04-functions.sql), which mirrors
 * `@jobhunter/shared-utils`' `APPLICATION_TRANSITIONS`.
 *
 * The `snapshot*` columns are the immutable freeze PLAN.md's "approval
 * freezes an immutable snapshot" requires -- written exactly once, by
 * `ApplicationsService.transition()`, the moment `status` becomes
 * `approved`, and never touched again (there is no code path that updates
 * them a second time). `snapshotChecksum{Pdf,Docx}` are sha256 of the
 * actual rendered bytes at that moment -- re-hashing the file on disk
 * later and comparing is how "byte-identical to the downloaded PDF" is
 * literally checked, not asserted.
 */
export const applications = pgTable(
  "applications",
  {
    id: primaryId(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid()
      .notNull()
      .references(() => jobCanonical.id, { onDelete: "cascade" }),
    documentId: uuid().references(() => documents.id, { onDelete: "set null" }),
    status: applicationStatus().notNull().default("discovered"),

    snapshotChecksumPdf: text(),
    snapshotChecksumDocx: text(),
    snapshotClaimIds: uuid().array(),
    snapshotModel: text(),
    snapshotPromptVersion: text(),
    snapshotCassetteKey: text(),
    approvedAt: timestamptz(),
    appliedAt: timestamptz(),

    ...timestamps(),
  },
  (t) => [
    uniqueIndex("uq_applications_owner_job").on(t.ownerId, t.jobId),
    index("idx_applications_owner_status").on(t.ownerId, t.status),
  ],
);

/**
 * Append-only audit trail (same two-layer pattern as evidence/job_raw/
 * document_spans) -- every transition a real application walked through,
 * in order, is historical fact once recorded.
 */
export const applicationTransitions = pgTable(
  "application_transitions",
  {
    id: primaryId(),
    applicationId: uuid()
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Null only for the row created alongside the application itself (its initial "discovered" state has no prior status). */
    fromStatus: applicationStatus(),
    toStatus: applicationStatus().notNull(),
    note: text(),
    occurredAt: timestamptz().notNull().defaultNow(),
  },
  (t) => [
    index("idx_application_transitions_application").on(t.applicationId, t.occurredAt),
  ],
);
