import { and, eq, sql } from "drizzle-orm";
import { runAsOwner, schema } from "@jobhunter/db";
import type { Db } from "@jobhunter/db";

export async function printReport(db: Db, ownerId: string): Promise<void> {
  await runAsOwner(db, ownerId, async (tx) => {
    console.log("\n========================================");
    console.log("Ingest report");
    console.log("========================================");

    const [experienceCount] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.experiences)
      .where(eq(schema.experiences.ownerId, ownerId));
    const [projectCount] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.projects)
      .where(eq(schema.projects.ownerId, ownerId));
    const [workEntryCount] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.workEntries)
      .where(eq(schema.workEntries.ownerId, ownerId));

    console.log(`\nExperiences: ${experienceCount?.count ?? 0}`);
    console.log(`Projects: ${projectCount?.count ?? 0}`);
    console.log(`Work entries: ${workEntryCount?.count ?? 0}`);

    const claimsByVerification = await tx
      .select({
        verification: schema.claims.verification,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.claims)
      .where(
        and(
          eq(schema.claims.ownerId, ownerId),
          sql`${schema.claims.confirmedAt} IS NOT NULL`,
        ),
      )
      .groupBy(schema.claims.verification);

    console.log("\nConfirmed claims by verification level:");
    for (const row of claimsByVerification) {
      console.log(`  ${row.verification}: ${row.count}`);
    }

    const [unconfirmedCount] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.claims)
      .where(
        and(
          eq(schema.claims.ownerId, ownerId),
          sql`${schema.claims.confirmedAt} IS NULL`,
        ),
      );
    console.log(`  unconfirmed (disputed or pending): ${unconfirmedCount?.count ?? 0}`);

    const emittable = await tx.execute(
      sql`SELECT count(*)::int AS count FROM v_emittable_claims WHERE owner_id = ${ownerId}::uuid`,
    );
    console.log(
      `\nEmittable claims (would ever appear on a generated resume): ${emittable[0]?.count ?? 0}`,
    );

    const openConflicts = await tx.query.conflicts.findMany({
      where: and(
        eq(schema.conflicts.ownerId, ownerId),
        eq(schema.conflicts.status, "open"),
      ),
      with: { positions: true },
    });

    console.log(`\nOpen conflicts: ${openConflicts.length}`);
    for (const conflict of openConflicts) {
      console.log(
        `\n  [${conflict.kind}${conflict.blocksEmission ? ", BLOCKS EMISSION" : ""}] ${conflict.subject}`,
      );
      for (const pos of conflict.positions) {
        console.log(`    - ${pos.display} (strength ${pos.strength})`);
      }
    }

    if (openConflicts.length === 0) {
      console.log("  (none)");
    }

    console.log("\n========================================\n");
  });
}
