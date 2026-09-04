import { eq } from "drizzle-orm";
import { schema, type Tx } from "@jobhunter/db";
import { normalizeSkillMention } from "@jobhunter/shared-utils";

type TaxonomyNodeKind = (typeof schema.taxonomyNodes.$inferInsert)["kind"];

function slugify(name: string): string {
  return normalizeSkillMention(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Exact-alias-first resolution (PLAN.md's "Skill graph" section): normalize
 * the mention, look it up in `taxonomy_aliases`, and only create a new node
 * if nothing hits. A node created this way is `proposed`, not `canonical`
 * -- it participates in matching but stays out of resume emission and the
 * canonical graph until a human approves it (Phase 3's own review step,
 * not built yet; the flag is what makes that review possible later without
 * a data migration).
 */
export async function resolveOrProposeTechnology(
  db: Tx,
  name: string,
  kind: TaxonomyNodeKind = "technology",
): Promise<{ id: string; created: boolean }> {
  const normalized = normalizeSkillMention(name);

  const existingAlias = await db.query.taxonomyAliases.findFirst({
    where: eq(schema.taxonomyAliases.normalized, normalized),
  });
  if (existingAlias) return { id: existingAlias.nodeId, created: false };

  const slug = slugify(name);
  const existingNode = await db.query.taxonomyNodes.findFirst({
    where: eq(schema.taxonomyNodes.slug, slug),
  });
  if (existingNode) {
    await db
      .insert(schema.taxonomyAliases)
      .values({ nodeId: existingNode.id, alias: name, normalized })
      .onConflictDoNothing({ target: schema.taxonomyAliases.normalized });
    return { id: existingNode.id, created: false };
  }

  const [node] = await db
    .insert(schema.taxonomyNodes)
    .values({ kind, canonicalName: name, slug, reviewStatus: "proposed" })
    .returning();
  if (!node)
    throw new Error(`resolveOrProposeTechnology: failed to create node for "${name}"`);

  await db
    .insert(schema.taxonomyAliases)
    .values({ nodeId: node.id, alias: name, normalized })
    .onConflictDoNothing({ target: schema.taxonomyAliases.normalized });

  return { id: node.id, created: true };
}
