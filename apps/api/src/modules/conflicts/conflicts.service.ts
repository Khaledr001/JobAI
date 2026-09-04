import { Inject, Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { runAsOwner, schema, type Db } from "@jobhunter/db";
import { AppError, ERROR_CODES } from "@jobhunter/shared-utils";
import { DB } from "../../database/database.module.js";
import type { ResolveConflictDto } from "./dto.js";

@Injectable()
export class ConflictsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async listConflicts(ownerId: string) {
    return runAsOwner(this.db, ownerId, (tx) =>
      tx.query.conflicts.findMany({
        where: eq(schema.conflicts.ownerId, ownerId),
        orderBy: desc(schema.conflicts.createdAt),
        with: { positions: true },
      }),
    );
  }

  /**
   * Resolution never picks a value on the operator's behalf -- it only
   * records the decision (status + note). Whatever follow-up that decision
   * implies (splitting a claim, filling in an experience's endedOn) happens
   * through the ordinary claims/profile endpoints, not here.
   */
  async resolveConflict(ownerId: string, conflictId: string, dto: ResolveConflictDto) {
    return runAsOwner(this.db, ownerId, async (tx) => {
      const [row] = await tx
        .update(schema.conflicts)
        .set({
          status: dto.status,
          resolutionNote: dto.resolutionNote,
          resolvedAt: new Date(),
          resolvedBy: ownerId,
          blocksEmission: false,
        })
        .where(eq(schema.conflicts.id, conflictId))
        .returning();
      if (!row) {
        throw new AppError(ERROR_CODES.NOT_FOUND, `Conflict ${conflictId} not found`);
      }
      return row;
    });
  }
}
