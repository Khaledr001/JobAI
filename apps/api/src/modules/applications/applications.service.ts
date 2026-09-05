import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Inject, Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { runAsOwner, schema, type Db } from "@jobhunter/db";
import {
  AppError,
  ERROR_CODES,
  isLegalApplicationTransition,
} from "@jobhunter/shared-utils";
import type { ApplicationStatus } from "@jobhunter/shared-types";
import { DB } from "../../database/database.module.js";
import type { CreateApplicationDto, TransitionApplicationDto } from "./dto.js";

/**
 * PLAN.md's state machine + immutable approval snapshot. Every transition
 * is checked against `APPLICATION_TRANSITIONS` here AND against the
 * mirrored `applications_validate_transition` DB trigger
 * (sql/04-functions.sql) -- the same two-independent-layers discipline
 * the claim ledger uses, so a bug in this service alone can never move an
 * application through an illegal state.
 */
@Injectable()
export class ApplicationsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async create(ownerId: string, dto: CreateApplicationDto) {
    return runAsOwner(this.db, ownerId, async (tx) => {
      const [application] = await tx
        .insert(schema.applications)
        .values({ ownerId, jobId: dto.jobId })
        .returning();
      if (!application) {
        throw new AppError(ERROR_CODES.INTERNAL, "applications insert returned no row");
      }
      await tx.insert(schema.applicationTransitions).values({
        applicationId: application.id,
        ownerId,
        fromStatus: null,
        toStatus: "discovered",
      });
      return application;
    });
  }

  async list(ownerId: string) {
    return runAsOwner(this.db, ownerId, (tx) =>
      tx.query.applications.findMany({
        where: eq(schema.applications.ownerId, ownerId),
        orderBy: desc(schema.applications.updatedAt),
      }),
    );
  }

  async get(ownerId: string, id: string) {
    return runAsOwner(this.db, ownerId, async (tx) => {
      const application = await tx.query.applications.findFirst({
        where: eq(schema.applications.id, id),
        with: { transitions: true },
      });
      if (!application) {
        throw new AppError(ERROR_CODES.NOT_FOUND, `Application ${id} not found`);
      }
      return application;
    });
  }

  async transition(ownerId: string, id: string, dto: TransitionApplicationDto) {
    return runAsOwner(this.db, ownerId, async (tx) => {
      const current = await tx.query.applications.findFirst({
        where: eq(schema.applications.id, id),
      });
      if (!current) {
        throw new AppError(ERROR_CODES.NOT_FOUND, `Application ${id} not found`);
      }

      const from = current.status as ApplicationStatus;
      if (!isLegalApplicationTransition(from, dto.status)) {
        throw new AppError(
          ERROR_CODES.ILLEGAL_APPLICATION_TRANSITION,
          `Cannot move application ${id} from "${from}" to "${dto.status}"`,
        );
      }

      const patch: Partial<typeof schema.applications.$inferInsert> = {
        status: dto.status,
        updatedAt: new Date(),
      };

      if (dto.status === "drafted") {
        if (!dto.documentId) {
          throw new AppError(
            ERROR_CODES.VALIDATION_FAILED,
            'documentId is required when transitioning to "drafted"',
          );
        }
        const document = await tx.query.documents.findFirst({
          where: eq(schema.documents.id, dto.documentId),
        });
        if (!document) {
          throw new AppError(
            ERROR_CODES.NOT_FOUND,
            `Document ${dto.documentId} not found`,
          );
        }
        if (document.jobId !== current.jobId) {
          throw new AppError(
            ERROR_CODES.VALIDATION_FAILED,
            `Document ${dto.documentId} was generated for a different job than this application's`,
          );
        }
        patch.documentId = document.id;
      }

      if (dto.status === "approved") {
        Object.assign(patch, await this.buildApprovalSnapshot(tx, current));
        patch.approvedAt = new Date();
      }

      if (dto.status === "applied") {
        patch.appliedAt = new Date();
      }

      const [updated] = await tx
        .update(schema.applications)
        .set(patch)
        .where(eq(schema.applications.id, id))
        .returning();
      if (!updated) {
        throw new AppError(ERROR_CODES.INTERNAL, "applications update returned no row");
      }

      await tx.insert(schema.applicationTransitions).values({
        applicationId: id,
        ownerId,
        fromStatus: from,
        toStatus: dto.status,
        note: dto.note,
      });

      return updated;
    });
  }

  /**
   * The immutable freeze PLAN.md's "approval freezes an immutable snapshot"
   * requires: a checksum of the ACTUAL bytes on disk right now (not
   * whatever the `documents` row claims -- if the file were ever
   * hand-edited after generation, this would freeze the tampered bytes'
   * real checksum, not silently trust the row), the exact claim set cited,
   * and the model/prompt/cassette key that produced them. Written exactly
   * once, at the moment of this transition, never touched again.
   */
  private async buildApprovalSnapshot(
    tx: Parameters<Parameters<Db["transaction"]>[0]>[0],
    application: { documentId: string | null },
  ) {
    if (!application.documentId) {
      throw new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        "Cannot approve an application with no drafted document",
      );
    }
    const document = await tx.query.documents.findFirst({
      where: eq(schema.documents.id, application.documentId),
    });
    if (!document) {
      throw new AppError(
        ERROR_CODES.NOT_FOUND,
        `Document ${application.documentId} not found`,
      );
    }

    const spans = await tx.query.documentSpans.findMany({
      where: eq(schema.documentSpans.documentId, document.id),
    });
    const claimIds = [...new Set(spans.flatMap((s) => s.claimIds))];

    const pdfBytes = readFileSync(document.filePathPdf);
    const docxBytes = readFileSync(document.filePathDocx);

    return {
      snapshotChecksumPdf: createHash("sha256").update(pdfBytes).digest("hex"),
      snapshotChecksumDocx: createHash("sha256").update(docxBytes).digest("hex"),
      snapshotClaimIds: claimIds,
      snapshotModel: document.model,
      snapshotPromptVersion: document.promptVersion,
      snapshotCassetteKey: document.cassetteKey,
    };
  }
}
