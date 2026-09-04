import { eq, sql } from "drizzle-orm";
import { createDb } from "../src/client.js";
import { runAsOwner } from "../src/context.js";
import {
  profiles,
  profileVersions,
  taxonomyAliases,
  taxonomyNodes,
  users,
} from "../src/schema/index.js";

/**
 * The invariant seed: the operator's user row and a small technology
 * bootstrap. Idempotent -- every write is an upsert, safe to re-run.
 *
 * The real ~150-node taxonomy import from resume.md / the portfolio /
 * git history is Phase 3's job (tools/ingest). This seeds just enough
 * canonical nodes (his actual known stack) for the Add-Work UI's
 * technology picker to be usable before that exists.
 */

const BOOTSTRAP_TECHNOLOGIES: Array<{ slug: string; name: string; aliases?: string[] }> =
  [
    { slug: "nestjs", name: "NestJS", aliases: ["nest.js", "nest"] },
    { slug: "typescript", name: "TypeScript", aliases: ["ts"] },
    { slug: "nodejs", name: "Node.js", aliases: ["node"] },
    { slug: "postgresql", name: "PostgreSQL", aliases: ["postgres"] },
    { slug: "drizzle-orm", name: "Drizzle", aliases: ["drizzle-orm"] },
    { slug: "redis", name: "Redis" },
    { slug: "nextjs", name: "Next.js", aliases: ["next.js", "next"] },
    { slug: "react", name: "React" },
    { slug: "angular", name: "Angular" },
    { slug: "docker", name: "Docker" },
    { slug: "tailwindcss", name: "Tailwind CSS", aliases: ["tailwind"] },
    { slug: "bullmq", name: "BullMQ" },
    { slug: "dotnet", name: ".NET", aliases: ["dotnet", "asp.net core"] },
    { slug: "csharp", name: "C#", aliases: ["c#", "csharp"] },
    { slug: "ef-core", name: "EF Core", aliases: ["entity framework core"] },
    { slug: "mongodb", name: "MongoDB" },
    { slug: "rabbitmq", name: "RabbitMQ" },
    { slug: "nats", name: "NATS" },
    { slug: "mikrotik-api", name: "MikroTik RouterOS API", aliases: ["mikrotik"] },
  ];

async function main() {
  const connectionString = process.env.DATABASE_URL_MIGRATOR;
  if (!connectionString) {
    throw new Error("DATABASE_URL_MIGRATOR is required to seed.");
  }

  const email = process.env.OPERATOR_EMAIL;
  const passwordHash = process.env.OPERATOR_PASSWORD_HASH;
  if (!email || !passwordHash) {
    throw new Error(
      "OPERATOR_EMAIL and OPERATOR_PASSWORD_HASH must be set. " +
        "Generate a hash with: pnpm --filter @jobhunter/api hash-password <plaintext>",
    );
  }

  const db = createDb(connectionString, 1);

  const [operator] = await db
    .insert(users)
    .values({ email, passwordHash, displayName: "Khaled" })
    .onConflictDoUpdate({
      target: users.email,
      set: { passwordHash, updatedAt: sql`now()` },
    })
    .returning();

  if (!operator) {
    throw new Error("seed: failed to create or update the operator user row");
  }
  console.log(`Operator user: ${operator.id} (${operator.email})`);

  await runAsOwner(db, operator.id, async (tx) => {
    await tx
      .insert(profiles)
      .values({ ownerId: operator.id })
      .onConflictDoNothing({ target: profiles.ownerId });

    await tx
      .insert(profileVersions)
      .values({ ownerId: operator.id })
      .onConflictDoNothing({ target: profileVersions.ownerId });
  });
  console.log("Profile + profile_versions rows ready.");

  let createdNodes = 0;
  for (const tech of BOOTSTRAP_TECHNOLOGIES) {
    const existing = await db.query.taxonomyNodes.findFirst({
      where: eq(taxonomyNodes.slug, tech.slug),
    });
    const node =
      existing ??
      (
        await db
          .insert(taxonomyNodes)
          .values({ kind: "technology", canonicalName: tech.name, slug: tech.slug })
          .returning()
      )[0];
    if (!existing) createdNodes++;
    if (!node) continue;

    for (const alias of [tech.name, ...(tech.aliases ?? [])]) {
      await db
        .insert(taxonomyAliases)
        .values({ nodeId: node.id, alias, normalized: normalizeForSeed(alias) })
        .onConflictDoNothing({ target: taxonomyAliases.normalized });
    }
  }
  console.log(
    `Taxonomy bootstrap: ${createdNodes} new node(s), ${BOOTSTRAP_TECHNOLOGIES.length} total checked.`,
  );

  await db.$client.end();
}

/**
 * Deliberately duplicated from packages/shared-utils's normalizeSkillMention
 * rather than imported: packages/db has no dependency on shared-utils
 * (it's a data-access package, not a place for scoring/matching logic), and
 * this one normalization is simple enough to not be worth adding one for.
 * If it drifts from the real normalizer, that's a taxonomy alias bug, not a
 * fabrication-safety bug -- worth watching, not worth coupling packages over.
 */
function normalizeForSeed(raw: string): string {
  return raw
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s#+.-]/gu, "");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
