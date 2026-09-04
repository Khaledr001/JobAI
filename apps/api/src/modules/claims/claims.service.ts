import { Inject, Injectable } from "@nestjs/common";
import { desc, eq, sql } from "drizzle-orm";
import { runAsOwner, schema, type Db } from "@jobhunter/db";
import { AppError, ERROR_CODES } from "@jobhunter/shared-utils";
import { DB } from "../../database/database.module.js";
import type { AttachEvidenceDto, CreateClaimDto } from "./dto.js";

@Injectable()
export class ClaimsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async listClaims(ownerId: string) {
    return runAsOwner(this.db, ownerId, (tx) =>
      tx.query.claims.findMany({
        where: eq(schema.claims.ownerId, ownerId),
        orderBy: desc(schema.claims.createdAt),
        with: { evidence: true },
      }),
    );
  }

  async createClaim(ownerId: string, dto: CreateClaimDto) {
    return runAsOwner(this.db, ownerId, async (tx) => {
      const [row] = await tx
        .insert(schema.claims)
        .values({ ownerId, ...dto })
        .returning();
      return row;
    });
  }

  async attachEvidence(ownerId: string, claimId: string, dto: AttachEvidenceDto) {
    return runAsOwner(this.db, ownerId, async (tx) => {
      const claim = await tx.query.claims.findFirst({
        where: eq(schema.claims.id, claimId),
      });
      if (!claim) {
        throw new AppError(ERROR_CODES.NOT_FOUND, `Claim ${claimId} not found`);
      }
      const [row] = await tx
        .insert(schema.evidence)
        .values({ ownerId, claimId, ...dto })
        .returning();
      return row;
    });
  }

  /**
   * The only path that sets confirmedAt/confirmedBy/verification -- see
   * sql/01-grants.sql (jobhunter_app has no UPDATE grant on those columns)
   * and sql/04-functions.sql (promote_claim, SECURITY DEFINER). If the
   * claim has no evidence rows, the function raises and this throws.
   */
  async confirmClaim(ownerId: string, claimId: string, verification: string) {
    return runAsOwner(this.db, ownerId, async (tx) => {
      try {
        await tx.execute(
          sql`SELECT * FROM promote_claim(${claimId}::uuid, ${verification}::verification, ${ownerId}::uuid)`,
        );
      } catch (err) {
        // postgres.js/drizzle wraps the driver error (DrizzleQueryError),
        // so the RAISE EXCEPTION text promote_claim() throws lives on
        // `.cause`, not on `err.message` itself.
        const message = [
          err instanceof Error ? err.message : String(err),
          err instanceof Error && err.cause instanceof Error ? err.cause.message : "",
        ].join(" ");
        if (message.includes("has no evidence")) {
          throw new AppError(
            ERROR_CODES.VALIDATION_FAILED,
            `Claim ${claimId} cannot be confirmed: it has no attached evidence`,
          );
        }
        if (message.includes("not found or already rejected")) {
          throw new AppError(
            ERROR_CODES.NOT_FOUND,
            `Claim ${claimId} not found or already rejected`,
          );
        }
        throw err;
      }

      // promote_claim's RETURNING doesn't go through Drizzle's schema mapper
      // (raw tx.execute), so it comes back snake_case -- re-read through the
      // relational query API for a properly typed, camelCase response.
      const row = await tx.query.claims.findFirst({
        where: eq(schema.claims.id, claimId),
      });
      if (!row) {
        throw new AppError(ERROR_CODES.NOT_FOUND, `Claim ${claimId} not found`);
      }
      return row;
    });
  }

  async rejectClaim(ownerId: string, claimId: string) {
    return runAsOwner(this.db, ownerId, async (tx) => {
      const [row] = await tx
        .update(schema.claims)
        .set({ rejectedAt: new Date() })
        .where(eq(schema.claims.id, claimId))
        .returning();
      if (!row) {
        throw new AppError(ERROR_CODES.NOT_FOUND, `Claim ${claimId} not found`);
      }
      return row;
    });
  }
}
