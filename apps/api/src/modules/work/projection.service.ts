import { Injectable, Logger } from "@nestjs/common";
import { and, eq, isNull, sql } from "drizzle-orm";
import { schema, type Tx } from "@jobhunter/db";
import { computeTechnologyScore, type TechUsageEntry } from "@jobhunter/shared-utils";

/**
 * The "projection job" from PLAN.md's Phase 1 deliverables: recomputes
 * technology_scores FROM the work_entries ledger. Deliberately synchronous
 * and called directly after each write rather than queued -- there is no
 * BullMQ/Redis job infrastructure in apps/api yet (that lands with
 * packages/llm in Phase 4). At this system's actual write volume (one
 * operator logging work entries by hand) a synchronous recompute scoped to
 * the technologies a single entry touches is imperceptible; a nightly
 * full-owner pass to account for pure time-decay (no new entries, but
 * `recencyScore` still drifts as `asOf` moves forward) is a Phase 4+
 * scheduling concern, not a Phase 1 one.
 *
 * Every method takes the CALLER's transaction (from runAsOwner) rather than
 * opening its own -- a projection recompute must never commit separately
 * from the work-entry write that triggered it.
 */
@Injectable()
export class ProjectionService {
  private readonly logger = new Logger(ProjectionService.name);

  async recomputeTechnologies(
    tx: Tx,
    ownerId: string,
    technologyIds: readonly string[],
    asOf: Date = new Date(),
  ): Promise<void> {
    if (technologyIds.length === 0) return;

    const [bumped] = await tx
      .insert(schema.profileVersions)
      .values({ ownerId, version: 1 })
      .onConflictDoUpdate({
        target: schema.profileVersions.ownerId,
        set: {
          version: sql`${schema.profileVersions.version} + 1`,
          bumpedAt: sql`now()`,
        },
      })
      .returning({ version: schema.profileVersions.version });

    if (!bumped) {
      throw new Error("recomputeTechnologies: failed to bump profile_versions");
    }

    for (const technologyId of new Set(technologyIds)) {
      await this.recomputeOne(tx, ownerId, technologyId, bumped.version, asOf);
    }
  }

  private async recomputeOne(
    tx: Tx,
    ownerId: string,
    technologyId: string,
    profileVersion: number,
    asOf: Date,
  ): Promise<void> {
    const rows = await tx
      .select({
        occurredOn: schema.workEntries.occurredOn,
        workEntryType: schema.workEntries.type,
        role: schema.workEntryTechnologies.role,
        sourceKind: schema.workEntries.sourceKind,
        sourceRef: schema.workEntries.sourceRef,
        projectId: schema.workEntries.projectId,
      })
      .from(schema.workEntryTechnologies)
      .innerJoin(
        schema.workEntries,
        eq(schema.workEntryTechnologies.workEntryId, schema.workEntries.id),
      )
      .where(
        and(
          eq(schema.workEntryTechnologies.technologyId, technologyId),
          eq(schema.workEntries.ownerId, ownerId),
          isNull(schema.workEntries.retractedAt),
        ),
      );

    if (rows.length === 0) {
      // Every tagging of this technology was retracted -- remove its projection
      // rather than leaving a stale row the matcher could still read.
      await tx
        .delete(schema.technologyScores)
        .where(
          and(
            eq(schema.technologyScores.ownerId, ownerId),
            eq(schema.technologyScores.technologyId, technologyId),
          ),
        );
      return;
    }

    const entries: TechUsageEntry[] = rows.map((r) => ({
      occurredOn: r.occurredOn,
      workEntryType: r.workEntryType,
      tagRole: r.role,
      hasSourceEvidence: r.sourceKind !== null && r.sourceRef !== null,
      projectId: r.projectId,
    }));

    const score = computeTechnologyScore(entries, asOf);

    const values = {
      ownerId,
      technologyId,
      rawUsageCount: score.rawUsageCount,
      recencyScore: score.recencyScore.toFixed(4),
      depthScore: score.depthScore.toFixed(4),
      breadthScore: score.breadthScore.toFixed(4),
      compositeScore: score.compositeScore.toFixed(4),
      firstUsedOn: score.firstUsedOn,
      lastUsedOn: score.lastUsedOn,
      monthsActive: score.monthsActive,
      projectCount: score.projectCount,
      verification: score.verification,
      profileVersion,
    };

    await tx
      .insert(schema.technologyScores)
      .values(values)
      .onConflictDoUpdate({
        target: [schema.technologyScores.ownerId, schema.technologyScores.technologyId],
        set: { ...values, computedAt: sql`now()` },
      });

    this.logger.debug(
      `recomputed technology_scores for ${technologyId} (owner ${ownerId}): composite=${score.compositeScore.toFixed(3)}`,
    );
  }
}
