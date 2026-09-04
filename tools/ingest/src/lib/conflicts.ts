import { and, eq, inArray } from "drizzle-orm";
import { runAsOwner, schema, type Tx } from "@jobhunter/db";
import type { IngestContext } from "./writer.js";
import { MODULE_COUNT_SUBJECT } from "../importers/doc.js";

/**
 * Targeted detectors for the specific, known-real conflicts PLAN.md
 * documents (see "Conflicts" section) -- not a generic diff engine. Each
 * one is written against a real disagreement found on this machine; a
 * later phase can generalize once there's a second real case to
 * generalize from.
 */

const RESUME_LOCATOR_HINT = "resume.md";

/**
 * Takes an already-open `tx`, never opens its own transaction -- calling
 * `runAsOwner(ctx.db, ...)` again from inside an already-open transaction
 * self-deadlocks under `poolMax=1` (db.ts): the inner call blocks forever
 * waiting for the one connection the outer transaction is still holding.
 * This bug hung a real ingest run for 30 minutes before being caught.
 * `hasOpenConflictFor` below is the top-level convenience wrapper for
 * callers that are NOT already inside a transaction.
 */
async function hasOpenConflictForTx(
  tx: Tx,
  ownerId: string,
  subject: string,
): Promise<boolean> {
  const existing = await tx.query.conflicts.findFirst({
    where: and(
      eq(schema.conflicts.ownerId, ownerId),
      eq(schema.conflicts.subject, subject),
    ),
  });
  return existing !== undefined;
}

async function hasOpenConflictFor(ctx: IngestContext, subject: string): Promise<boolean> {
  return runAsOwner(ctx.db, ctx.ownerId, async (tx) => {
    const existing = await tx.query.conflicts.findFirst({
      where: and(
        eq(schema.conflicts.ownerId, ctx.ownerId),
        eq(schema.conflicts.subject, subject),
      ),
    });
    return existing !== undefined;
  });
}

/**
 * The flagship demonstration (PLAN.md): a milestone already in the past by
 * the time either PROJECT_DOCUMENTATION.md copy was written, and the two
 * copies disagree with each other about what it was -- on top of resume.md
 * and the portfolio each giving a third and fourth number. Kind is
 * "definition" rather than "count" when the units genuinely differ
 * ("modules" vs "content_types") -- PLAN.md: these may measure different
 * things, and the review UI must support splitting into two claims, not
 * just picking one.
 */
export async function detectModuleCountConflict(ctx: IngestContext): Promise<void> {
  if (ctx.dryRun) return;
  if (await hasOpenConflictFor(ctx, MODULE_COUNT_SUBJECT)) return;

  await runAsOwner(ctx.db, ctx.ownerId, async (tx) => {
    const claims = await tx.query.claims.findMany({
      where: and(
        eq(schema.claims.ownerId, ctx.ownerId),
        eq(schema.claims.subject, MODULE_COUNT_SUBJECT),
      ),
      with: { evidence: true },
    });

    const distinctPositions = new Map<string, (typeof claims)[number]>();
    for (const claim of claims) {
      const count = claim.quantities.count;
      const unit = claim.quantities.unit;
      distinctPositions.set(`${count}:${unit}`, claim);
    }

    if (distinctPositions.size < 2) {
      ctx.stats.bump("conflicts (module count: not enough distinct positions yet)");
      return;
    }

    const units = new Set([...distinctPositions.values()].map((c) => c.quantities.unit));
    const kind = units.size > 1 ? "definition" : "count";

    const [conflict] = await tx
      .insert(schema.conflicts)
      .values({
        ownerId: ctx.ownerId,
        kind,
        subject: MODULE_COUNT_SUBJECT,
        blocksEmission: true,
      })
      .returning();
    if (!conflict) throw new Error("detectModuleCountConflict: insert returned no row");

    for (const claim of distinctPositions.values()) {
      const evidenceDate = claim.evidence[0]?.occurredOn ?? null;
      const evidenceKind = claim.evidence[0]?.kind ?? "attestation";
      // doc_section (a dated, authored document) outranks a bare resume/portfolio attestation.
      const strength = evidenceKind === "doc_section" ? "0.700" : "0.400";

      await tx.insert(schema.conflictPositions).values({
        ownerId: ctx.ownerId,
        conflictId: conflict.id,
        value: { count: claim.quantities.count, unit: claim.quantities.unit },
        display: `${claim.quantities.count}${claim.quantities.qualifier === "at_least" ? "+" : ""} ${claim.quantities.unit}`,
        evidenceId: claim.evidence[0]?.id,
        strength,
      });
      await tx
        .insert(schema.conflictClaims)
        .values({ ownerId: ctx.ownerId, conflictId: conflict.id, claimId: claim.id });
      void evidenceDate;
    }

    ctx.stats.bump("conflicts (created)");
    console.log(
      `  + conflict: ${MODULE_COUNT_SUBJECT} -- ${distinctPositions.size} distinct positions (kind=${kind})`,
    );
  });
}

/**
 * A `coverage_gap` conflict for an experience or project the operator
 * clearly did the work for (it has real evidence -- a work-log entry, a
 * portfolio bullet) but that never made it into `resume.md`. Non-blocking:
 * this is a decision to surface (should it be added, or does it correctly
 * not count?), not a contradiction to resolve.
 */
async function detectCoverageGap(
  ctx: IngestContext,
  subject: string,
  claimKind: (typeof schema.claims.$inferSelect)["kind"],
): Promise<boolean> {
  if (await hasOpenConflictFor(ctx, `${subject} — missing from resume.md`)) return false;

  return runAsOwner(ctx.db, ctx.ownerId, async (tx) => {
    const resumeEverRan = await tx.query.evidence.findFirst({
      where: eq(schema.evidence.ownerId, ctx.ownerId),
    });
    if (!resumeEverRan) return false; // nothing ingested yet at all -- too early to call anything "missing"

    const claims = await tx.query.claims.findMany({
      where: and(
        eq(schema.claims.ownerId, ctx.ownerId),
        eq(schema.claims.subject, subject),
        eq(schema.claims.kind, claimKind),
      ),
      with: { evidence: true },
    });
    if (claims.length === 0) return false; // nothing to be missing FROM anything else

    const citedByResume = claims.some((c) =>
      c.evidence.some((e) => e.locator.includes(RESUME_LOCATOR_HINT)),
    );
    if (citedByResume) return false;

    const [conflict] = await tx
      .insert(schema.conflicts)
      .values({
        ownerId: ctx.ownerId,
        kind: "coverage_gap",
        subject: `${subject} — missing from resume.md`,
        blocksEmission: false,
      })
      .returning();
    if (!conflict) throw new Error("detectCoverageGap: insert returned no row");

    for (const claim of claims) {
      const firstEvidence = claim.evidence[0];
      await tx.insert(schema.conflictPositions).values({
        ownerId: ctx.ownerId,
        conflictId: conflict.id,
        value: { presentIn: firstEvidence ? [firstEvidence.locator] : [] },
        display: firstEvidence
          ? `documented in ${firstEvidence.locator}`
          : "documented elsewhere",
        evidenceId: firstEvidence?.id,
        strength: "0.500",
      });
      await tx
        .insert(schema.conflictClaims)
        .values({ ownerId: ctx.ownerId, conflictId: conflict.id, claimId: claim.id });
    }

    ctx.stats.bump("conflicts (created)");
    console.log(
      `  + conflict (coverage gap): ${subject} is real, documented work absent from resume.md`,
    );
    return true;
  });
}

/** PLAN.md conflict #6: the telemedicine role is in the portfolio, dated Jun-Nov 2023, and absent from resume.md entirely. */
export async function detectTelemedicineCoverageGap(ctx: IngestContext): Promise<void> {
  if (ctx.dryRun) return;
  await detectCoverageGap(ctx, "Non-Profit Organization", "held_role");
}

/** PLAN.md conflict #9: Igala is real (work-log.txt, and a live project directory) but appears in neither resume.md nor the portfolio. */
export async function detectIgalaCoverageGap(ctx: IngestContext): Promise<void> {
  if (ctx.dryRun) return;

  const flaggedByHeldRole = await detectCoverageGap(ctx, "Igala", "delivered_project");
  if (flaggedByHeldRole) return;

  // Igala has no resume/portfolio-style claim at all (it only ever appears
  // as a bare project name in work-log.txt) -- check the project itself
  // rather than a claim, since detectCoverageGap needs a claim to exist.
  await runAsOwner(ctx.db, ctx.ownerId, async (tx) => {
    const project = await tx.query.projects.findFirst({
      where: and(
        eq(schema.projects.ownerId, ctx.ownerId),
        eq(schema.projects.slug, "igala"),
      ),
    });
    if (!project) return;

    if (await hasOpenConflictForTx(tx, ctx.ownerId, "Igala — never published")) return;

    const anyOtherSource = await tx.query.evidence.findFirst({
      where: and(
        eq(schema.evidence.ownerId, ctx.ownerId),
        inArray(schema.evidence.kind, ["attestation"]),
      ),
    });
    if (!anyOtherSource) return; // resume/portfolio haven't run yet -- too early to call it missing

    const [conflict] = await tx
      .insert(schema.conflicts)
      .values({
        ownerId: ctx.ownerId,
        kind: "coverage_gap",
        subject: "Igala — never published",
        blocksEmission: false,
        resolutionNote:
          "Real work (see work-log.txt) with no resume or portfolio entry. " +
          "Full matcher visibility is correct; whether to add it to the resume is a decision, not a defect.",
      })
      .returning();
    if (conflict) {
      ctx.stats.bump("conflicts (created)");
      console.log(
        `  + conflict (coverage gap): Igala is real work never published in resume.md or the portfolio`,
      );
    }
  });
}

export async function runConflictDetectors(ctx: IngestContext): Promise<void> {
  console.log("\n=== conflicts: running detectors ===");
  await detectModuleCountConflict(ctx);
  await detectTelemedicineCoverageGap(ctx);
  await detectIgalaCoverageGap(ctx);
}
