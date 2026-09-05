import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { schema, type Db } from "@jobhunter/db";
import { AppError, ERROR_CODES } from "@jobhunter/shared-utils";
import {
  strongDedupKey,
  type DiscoveryTask,
  type JobSourceAdapter,
} from "@jobhunter/sources";
import { DB } from "../../database/database.module.js";

export interface IngestSummary {
  discovered: number;
  rawInserted: number;
  rawSkipped: number;
  canonicalInserted: number;
  canonicalUpdated: number;
  drifted: number;
}

/**
 * The dedup cascade's "exact" and "strong" tiers (PLAN.md §Job ingestion).
 * `job_raw` is idempotent on (provider, source_job_id, payload_hash) --
 * re-fetching an unchanged listing inserts zero new raw rows. `job_canonical`
 * is upserted on `strongDedupKey()` (packages/sources), scoped to open
 * (not-yet-closed) rows via the partial unique index, so a re-ingest
 * updates the existing row (title/description/lastSeenAt) instead of
 * duplicating it. The fuzzy pg_trgm/embedding tiers PLAN.md describes are a
 * Phase 6 (Matching) concern -- see schema/jobs.ts.
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(@Inject(DB) private readonly db: Db) {}

  async ingestFromAdapter(
    adapter: JobSourceAdapter,
    task: DiscoveryTask = {},
  ): Promise<IngestSummary> {
    const { listings } = await adapter.discover(task);
    const summary: IngestSummary = {
      discovered: listings.length,
      rawInserted: 0,
      rawSkipped: 0,
      canonicalInserted: 0,
      canonicalUpdated: 0,
      drifted: 0,
    };

    await this.db.transaction(async (tx) => {
      for (const raw of listings) {
        const [rawRow] = await tx
          .insert(schema.jobRaw)
          .values({
            provider: raw.sourceId,
            sourceJobId: raw.sourceJobId,
            payloadHash: raw.payloadHash,
            rawPayload: raw.rawPayload,
            fetchedAt: raw.fetchedAt,
          })
          .onConflictDoNothing({
            target: [
              schema.jobRaw.provider,
              schema.jobRaw.sourceJobId,
              schema.jobRaw.payloadHash,
            ],
          })
          .returning({ id: schema.jobRaw.id });

        let rawId: string;
        if (rawRow) {
          rawId = rawRow.id;
          summary.rawInserted++;
        } else {
          summary.rawSkipped++;
          const existing = await tx.query.jobRaw.findFirst({
            where: and(
              eq(schema.jobRaw.provider, raw.sourceId),
              eq(schema.jobRaw.sourceJobId, raw.sourceJobId),
              eq(schema.jobRaw.payloadHash, raw.payloadHash),
            ),
          });
          if (!existing) {
            throw new AppError(
              ERROR_CODES.INTERNAL,
              `job_raw conflict on (${raw.sourceId}, ${raw.sourceJobId}) but no existing row found`,
            );
          }
          rawId = existing.id;
        }

        let parsed;
        try {
          parsed = adapter.parse(raw);
        } catch (err) {
          if (err instanceof AppError && err.code === ERROR_CODES.SOURCE_SCHEMA_DRIFT) {
            summary.drifted++;
            this.logger.warn(err.message);
            continue;
          }
          throw err;
        }

        const dedupKey = strongDedupKey(parsed.company, parsed.title, parsed.location);
        const now = new Date();

        const [canonicalRow] = await tx
          .insert(schema.jobCanonical)
          .values({
            dedupKey,
            company: parsed.company,
            title: parsed.title,
            location: parsed.location,
            description: parsed.description,
            url: parsed.url,
            postedAt: parsed.postedAt,
            firstSeenAt: now,
            lastSeenAt: now,
          })
          .onConflictDoUpdate({
            target: [schema.jobCanonical.dedupKey],
            targetWhere: sql`${schema.jobCanonical.closedAt} IS NULL`,
            set: {
              title: parsed.title,
              location: parsed.location,
              description: parsed.description,
              url: parsed.url,
              postedAt: parsed.postedAt,
              lastSeenAt: now,
              updatedAt: now,
            },
          })
          // `xmax = 0` is the standard Postgres tell for "this row was just
          // inserted" vs "this row hit ON CONFLICT DO UPDATE" -- the only
          // way to distinguish the two from a single RETURNING clause.
          .returning({ id: schema.jobCanonical.id, inserted: sql<boolean>`(xmax = 0)` });

        if (!canonicalRow) {
          throw new AppError(
            ERROR_CODES.INTERNAL,
            "job_canonical upsert returned no row",
          );
        }
        if (canonicalRow.inserted) {
          summary.canonicalInserted++;
        } else {
          summary.canonicalUpdated++;
        }

        await tx
          .insert(schema.jobSourceListing)
          .values({
            canonicalId: canonicalRow.id,
            provider: raw.sourceId,
            sourceJobId: raw.sourceJobId,
            rawId,
            firstSeenAt: now,
            lastSeenAt: now,
          })
          .onConflictDoUpdate({
            target: [
              schema.jobSourceListing.provider,
              schema.jobSourceListing.sourceJobId,
            ],
            set: {
              canonicalId: canonicalRow.id,
              rawId,
              lastSeenAt: now,
              updatedAt: now,
            },
          });
      }
    });

    return summary;
  }

  async listCanonicalJobs(limit = 50) {
    return this.db.query.jobCanonical.findMany({
      orderBy: (job, { desc }) => desc(job.lastSeenAt),
      limit,
    });
  }

  async getCanonicalJob(jobId: string) {
    const job = await this.db.query.jobCanonical.findFirst({
      where: eq(schema.jobCanonical.id, jobId),
    });
    if (!job) {
      throw new AppError(ERROR_CODES.NOT_FOUND, `Job ${jobId} not found`);
    }
    return job;
  }
}
