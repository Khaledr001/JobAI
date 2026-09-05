import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { jobSourceProvider } from "./enums.js";
import { primaryId, timestamps, timestamptz } from "./_shared.js";

/**
 * Global, shared reference data -- deliberately NOT owner-scoped (no
 * owner_id, no RLS), same reasoning as taxonomy.ts: a job posting is not
 * one operator's private fact. Every table below follows that.
 */

/** Which adapter + board token fetches a given company's postings (PLAN.md's "company_ats registry"). */
export const companyAts = pgTable(
  "company_ats",
  {
    id: primaryId(),
    companyName: text().notNull(),
    provider: jobSourceProvider().notNull(),
    /** The slug in the adapter's URL, e.g. Greenhouse's `{token}` or Lever's `{company}` -- not always equal to companyName. */
    boardToken: text().notNull(),
    active: boolean().notNull().default(true),
    ...timestamps(),
  },
  (t) => [uniqueIndex("uq_company_ats_provider_token").on(t.provider, t.boardToken)],
);

/**
 * Append-only raw retention (PLAN.md §Job ingestion: "rawPayload +
 * payloadHash always retained, so when the parse prompt improves, reparse
 * from storage instead of re-hitting APIs"). No UPDATE/DELETE grant
 * (sql/01-grants.sql) and a trigger backstop (sql/03-triggers.sql), same
 * two-layer pattern as `evidence`. Idempotent on re-fetch: the unique index
 * on (provider, source_job_id, payload_hash) means re-ingesting an
 * unchanged listing inserts zero new rows (`ON CONFLICT DO NOTHING`).
 */
export const jobRaw = pgTable(
  "job_raw",
  {
    id: primaryId(),
    provider: jobSourceProvider().notNull(),
    sourceJobId: text().notNull(),
    payloadHash: text().notNull(),
    rawPayload: jsonb().$type<unknown>().notNull(),
    fetchedAt: timestamptz().notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("uq_job_raw_provider_job_hash").on(
      t.provider,
      t.sourceJobId,
      t.payloadHash,
    ),
    index("idx_job_raw_provider_job").on(t.provider, t.sourceJobId),
  ],
);

/**
 * The deduped job PLAN.md's matcher and dashboard actually read.
 * `dedupKey` is `strongDedupKey()` (packages/sources) today -- the
 * `pg_trgm`/embedding fuzzy tiers PLAN.md describes are a Phase 6
 * (Matching) concern, once `embeddings` exists; adding them later only
 * changes which rows the write path considers a match, not this schema.
 * The partial unique index (`WHERE closed_at IS NULL`) is what makes a
 * repost after a job closes a legitimate new row instead of a permanent
 * dedup collision -- `supersedesId` links it back to the closed original.
 */
export const jobCanonical = pgTable(
  "job_canonical",
  {
    id: primaryId(),
    dedupKey: text().notNull(),
    company: text().notNull(),
    title: text().notNull(),
    location: text(),
    description: text().notNull(),
    url: text().notNull(),
    postedAt: timestamptz(),
    closedAt: timestamptz(),
    supersedesId: uuid(),
    firstSeenAt: timestamptz().notNull(),
    lastSeenAt: timestamptz().notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("uq_job_canonical_dedup_key_open")
      .on(t.dedupKey)
      .where(sql`${t.closedAt} IS NULL`),
    index("idx_job_canonical_company").on(t.company),
  ],
);

/** n:1 join from a source's own listing id to the canonical job it resolved to -- the exact-key tier of the dedup cascade. */
export const jobSourceListing = pgTable(
  "job_source_listing",
  {
    id: primaryId(),
    canonicalId: uuid()
      .notNull()
      .references(() => jobCanonical.id, { onDelete: "cascade" }),
    provider: jobSourceProvider().notNull(),
    sourceJobId: text().notNull(),
    rawId: uuid()
      .notNull()
      .references(() => jobRaw.id, { onDelete: "restrict" }),
    firstSeenAt: timestamptz().notNull(),
    lastSeenAt: timestamptz().notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("uq_job_source_listing_provider_job").on(t.provider, t.sourceJobId),
    index("idx_job_source_listing_canonical").on(t.canonicalId),
  ],
);
