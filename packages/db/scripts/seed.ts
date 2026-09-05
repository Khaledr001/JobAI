import { and, eq, sql } from "drizzle-orm";
import { createDb } from "../src/client.js";
import { runAsOwner } from "../src/context.js";
import {
  profiles,
  profileVersions,
  taxonomyAliases,
  taxonomyEdges,
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
    // "next" and "ts" are dropped as aliases, not just here but deleted from
    // the real, already-seeded taxonomy_aliases table below: both are plain
    // English words/abbreviations far more likely to appear in ordinary JD
    // prose than as a genuine Next.js/TypeScript mention. Found for real by
    // apps/api's requirement-extraction matching "the next step in your
    // career" to Next.js against a live-ingested Greenhouse posting
    // (docs/DECISIONS.md).
    { slug: "nestjs", name: "NestJS", aliases: ["nest.js", "nest"] },
    { slug: "typescript", name: "TypeScript" },
    { slug: "nodejs", name: "Node.js", aliases: ["node"] },
    { slug: "postgresql", name: "PostgreSQL", aliases: ["postgres"] },
    { slug: "drizzle-orm", name: "Drizzle", aliases: ["drizzle-orm"] },
    { slug: "redis", name: "Redis" },
    { slug: "nextjs", name: "Next.js", aliases: ["next.js"] },
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

/**
 * PLAN.md's explicit warning: "The edge seed is a hidden dependency. An
 * empty graph makes every non-exact match score 0, which looks like a
 * broken scorer. Seed edges before the first scoring run." This is that
 * seed -- `implies` chains and weighted `adjacent` pairs over the real
 * bootstrap nodes above, tuned to this operator's actual stack rather than
 * the full ~120-edge set PLAN.md sketches (a smaller, honest, real seed
 * beats a padded one -- see docs/DECISIONS.md).
 */
const IMPLIES_EDGES: Array<[from: string, to: string]> = [
  ["NestJS", "TypeScript"],
  ["NestJS", "Node.js"],
  ["Angular", "TypeScript"],
  ["Next.js", "React"],
  ["EF Core", "C#"],
  ["EF Core", ".NET"],
  ["C#", ".NET"],
  ["MediatR", "C#"],
  ["Drizzle", "PostgreSQL"],
  ["BullMQ", "Redis"],
  ["BullMQ", "Node.js"],
  ["Socket.IO", "Node.js"],
  ["Strapi", "Node.js"],
  ["NgRx", "Angular"],
];

const ADJACENT_EDGES: Array<[from: string, to: string, weight: number]> = [
  ["Drizzle", "EF Core", 0.4],
  ["EF Core", "Drizzle", 0.4],
  ["PostgreSQL", "MongoDB", 0.25],
  ["MongoDB", "PostgreSQL", 0.25],
  ["NATS", "RabbitMQ", 0.7],
  ["RabbitMQ", "NATS", 0.7],
  ["Angular", "React", 0.5],
  ["React", "Angular", 0.5],
  ["Docker", "Nginx", 0.3],
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

  // All real nodes, not just this file's bootstrap list -- Phase 3's
  // real ingest run created many more (MediatR, Socket.IO, Strapi, ...),
  // and the edge seed below references some of them.
  const nodeIdByName = new Map<string, string>();
  for (const node of await db.query.taxonomyNodes.findMany()) {
    nodeIdByName.set(node.canonicalName, node.id);
  }

  let createdEdges = 0;
  const edgeRows: Array<[string, string, "implies" | "adjacent", number]> = [
    ...IMPLIES_EDGES.map(([from, to]): [string, string, "implies", number] => [
      from,
      to,
      "implies",
      1,
    ]),
    ...ADJACENT_EDGES.map(([from, to, weight]): [string, string, "adjacent", number] => [
      from,
      to,
      "adjacent",
      weight,
    ]),
  ];
  for (const [fromName, toName, relation, weight] of edgeRows) {
    const fromId = nodeIdByName.get(fromName);
    const toId = nodeIdByName.get(toName);
    if (!fromId || !toId) {
      console.warn(`Skipping edge ${fromName} -${relation}-> ${toName}: node not found.`);
      continue;
    }
    const existing = await db.query.taxonomyEdges.findFirst({
      where: and(
        eq(taxonomyEdges.fromNodeId, fromId),
        eq(taxonomyEdges.toNodeId, toId),
        eq(taxonomyEdges.relation, relation),
      ),
    });
    if (existing) continue;
    await db
      .insert(taxonomyEdges)
      .values({ fromNodeId: fromId, toNodeId: toId, relation, weight: weight.toFixed(3) })
      .onConflictDoNothing({
        target: [
          taxonomyEdges.fromNodeId,
          taxonomyEdges.toNodeId,
          taxonomyEdges.relation,
        ],
      });
    createdEdges++;
  }
  console.log(
    `Taxonomy edges: ${createdEdges} new edge(s), ${edgeRows.length} total checked.`,
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
