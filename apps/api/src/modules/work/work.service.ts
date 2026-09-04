import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { desc, eq, isNull, and } from "drizzle-orm";
import { runAsOwner, schema, type Db } from "@jobhunter/db";
import { AppError, ERROR_CODES } from "@jobhunter/shared-utils";
import { DB } from "../../database/database.module.js";
import { ProjectionService } from "./projection.service.js";
import type { CreateWorkEntryDto } from "./dto.js";

@Injectable()
export class WorkService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly projectionService: ProjectionService,
  ) {}

  async listWorkEntries(ownerId: string) {
    return runAsOwner(this.db, ownerId, (tx) =>
      tx.query.workEntries.findMany({
        where: and(
          eq(schema.workEntries.ownerId, ownerId),
          isNull(schema.workEntries.retractedAt),
        ),
        orderBy: desc(schema.workEntries.occurredOn),
        with: { technologies: { with: { technology: true } } },
      }),
    );
  }

  async createWorkEntry(ownerId: string, dto: CreateWorkEntryDto) {
    const contentHash = createHash("sha256")
      .update(normalizeForHash(dto.body))
      .digest("hex");

    return runAsOwner(this.db, ownerId, async (tx) => {
      const existing = await tx.query.workEntries.findFirst({
        where: and(
          eq(schema.workEntries.ownerId, ownerId),
          eq(schema.workEntries.contentHash, contentHash),
        ),
      });
      if (existing) {
        throw new AppError(
          ERROR_CODES.CONFLICT,
          "An identical work entry already exists",
          {
            workEntryId: existing.id,
          },
        );
      }

      const [entry] = await tx
        .insert(schema.workEntries)
        .values({
          ownerId,
          title: dto.title,
          body: dto.body,
          outcome: dto.outcome,
          type: dto.type,
          occurredOn: dto.occurredOn,
          occurredThrough: dto.occurredThrough,
          projectId: dto.projectId,
          epochId: dto.epochId,
          sourceKind: dto.sourceKind,
          sourceRef: dto.sourceRef,
          contentHash,
        })
        .returning();
      if (!entry) {
        throw new Error("createWorkEntry: insert returned no row");
      }

      if (dto.technologies.length > 0) {
        await tx.insert(schema.workEntryTechnologies).values(
          dto.technologies.map((t) => ({
            ownerId,
            workEntryId: entry.id,
            technologyId: t.technologyId,
            role: t.role,
          })),
        );
      }

      await this.projectionService.recomputeTechnologies(
        tx,
        ownerId,
        dto.technologies.map((t) => t.technologyId),
      );

      return entry;
    });
  }

  async retractWorkEntry(ownerId: string, workEntryId: string) {
    return runAsOwner(this.db, ownerId, async (tx) => {
      const taggedTechnologies = await tx.query.workEntryTechnologies.findMany({
        where: eq(schema.workEntryTechnologies.workEntryId, workEntryId),
      });

      const [row] = await tx
        .update(schema.workEntries)
        .set({ retractedAt: new Date() })
        .where(eq(schema.workEntries.id, workEntryId))
        .returning();
      if (!row) {
        throw new AppError(ERROR_CODES.NOT_FOUND, `Work entry ${workEntryId} not found`);
      }

      await this.projectionService.recomputeTechnologies(
        tx,
        ownerId,
        taggedTechnologies.map((t) => t.technologyId),
      );

      return row;
    });
  }

  async getTechnologyScores(ownerId: string) {
    return runAsOwner(this.db, ownerId, (tx) =>
      tx.query.technologyScores.findMany({
        where: eq(schema.technologyScores.ownerId, ownerId),
        orderBy: desc(schema.technologyScores.compositeScore),
        with: { technology: true },
      }),
    );
  }
}

/** Whitespace-insensitive so retyping the same entry with different line breaks still dedupes. */
function normalizeForHash(body: string): string {
  return body.trim().replace(/\s+/g, " ");
}
