import { and, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { runAsOwner, schema } from "@jobhunter/db";
import type { EvidenceKind, Verification } from "@jobhunter/shared-types";
import type { IngestContext } from "./writer.js";

/**
 * Runs LAST, after every importer and the conflict detectors. A claim
 * tangled in an open, blocking conflict is simply never promoted here --
 * it stays unconfirmed indefinitely, which is a valid, permanent state
 * (not "pending", just "not emittable until a human resolves it" -- see
 * `ConflictsService.resolveConflict`'s own comment: resolution never
 * promotes a claim on the operator's behalf either).
 */
const HIGH_TRUST_EVIDENCE: ReadonlySet<EvidenceKind> = new Set([
  "dependency_manifest",
  "git_commit",
  "git_file_presence",
  "doc_section",
]);

function verificationFor(evidenceKinds: EvidenceKind[]): Verification {
  return evidenceKinds.some((k) => HIGH_TRUST_EVIDENCE.has(k))
    ? "documented"
    : "attested";
}

export async function promoteUndisputedClaims(ctx: IngestContext): Promise<void> {
  if (ctx.dryRun) return;
  console.log("\n=== finalize: promoting undisputed claims ===");

  await runAsOwner(ctx.db, ctx.ownerId, async (tx) => {
    const claims = await tx.query.claims.findMany({
      where: and(eq(schema.claims.ownerId, ctx.ownerId)),
      with: { evidence: true },
    });

    const blockingConflictClaimIds = new Set(
      (
        await tx.query.conflictClaims.findMany({
          where: eq(schema.conflictClaims.ownerId, ctx.ownerId),
          with: { conflict: true },
        })
      )
        .filter((cc) => cc.conflict.status === "open" && cc.conflict.blocksEmission)
        .map((cc) => cc.claimId),
    );

    let promoted = 0;
    let skippedDisputed = 0;
    let skippedAlready = 0;

    for (const claim of claims) {
      if (claim.confirmedAt) {
        skippedAlready++;
        continue;
      }
      if (blockingConflictClaimIds.has(claim.id)) {
        skippedDisputed++;
        continue;
      }

      const verification = verificationFor(claim.evidence.map((e) => e.kind));
      await tx.execute(
        sql`SELECT * FROM promote_claim(${claim.id}::uuid, ${verification}::verification, ${ctx.ownerId}::uuid)`,
      );
      promoted++;
    }

    console.log(
      `  promoted ${promoted}, skipped ${skippedDisputed} (disputed), ${skippedAlready} (already confirmed)`,
    );
    ctx.stats.bump("claims (promoted)", promoted);
    ctx.stats.bump("claims (left unconfirmed, disputed)", skippedDisputed);
  });
}
