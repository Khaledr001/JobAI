/**
 * One-off (but safely re-runnable) repair: `tools/ingest` (Phase 3) writes
 * `work_entries`/`work_entry_technologies` directly via bulk SQL, bypassing
 * `WorkService`'s write path -- the only place `ProjectionService.recomputeTechnologies`
 * normally gets called. Real effect discovered while wiring Phase 7's
 * matching endpoint to real data: 243 real work entries and 184 real
 * technology taggings existed with zero `technology_scores` rows to show
 * for them, so every real match against a real job scored every required
 * technology as MISSING regardless of the operator's actual, confirmed
 * work. This recomputes the projection for every technology this owner
 * has ever tagged. Idempotent -- `recomputeTechnologies` is itself an
 * upsert, so running this again after new real work entries land is safe
 * and correct, not just harmless.
 */
import { createDb, runAsOwner, schema } from "@jobhunter/db";
import { eq } from "drizzle-orm";
import { ProjectionService } from "../src/modules/work/projection.service.js";

async function main() {
  const connectionString = process.env.DATABASE_URL_MIGRATOR;
  if (!connectionString) {
    throw new Error("DATABASE_URL_MIGRATOR is required.");
  }
  const ownerId = process.argv[2];
  if (!ownerId) {
    throw new Error("Usage: tsx scripts/backfill-technology-scores.ts <ownerId>");
  }

  const db = createDb(connectionString, 1);
  const projection = new ProjectionService();

  await runAsOwner(db, ownerId, async (tx) => {
    const tagged = await tx
      .selectDistinct({ technologyId: schema.workEntryTechnologies.technologyId })
      .from(schema.workEntryTechnologies)
      .innerJoin(
        schema.workEntries,
        eq(schema.workEntryTechnologies.workEntryId, schema.workEntries.id),
      )
      .where(eq(schema.workEntries.ownerId, ownerId));

    console.log(
      `Recomputing technology_scores for ${tagged.length} distinct technology/technologies...`,
    );
    await projection.recomputeTechnologies(
      tx,
      ownerId,
      tagged.map((t) => t.technologyId),
    );
  });

  console.log("Backfill complete.");
  await db.$client.end();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
