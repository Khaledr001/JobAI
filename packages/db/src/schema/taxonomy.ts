import { index, numeric, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { taxonomyEdgeRelation, taxonomyNodeKind, taxonomyReviewStatus } from "./enums.js";
import { primaryId, timestamps } from "./_shared.js";

/**
 * Global, shared reference data -- deliberately NOT owner-scoped (no
 * owner_id, no RLS). "NestJS" is not one operator's private fact; it is
 * vocabulary the matcher and the resume validator both need to agree on.
 * The tenancy seam (PLAN.md's "owner_id on every table") applies to a
 * user's own data, not to this canonical graph.
 */
export const taxonomyNodes = pgTable(
  "taxonomy_nodes",
  {
    id: primaryId(),
    kind: taxonomyNodeKind().notNull(),
    canonicalName: text().notNull(),
    slug: text().notNull(),
    reviewStatus: taxonomyReviewStatus().notNull().default("canonical"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("uq_taxonomy_nodes_slug").on(t.slug)],
);

/**
 * Alias resolution is exact-match first: normalize a mention, look it up
 * here, and only fall back to fuzzy matching (pg_trgm, added later) if
 * nothing hits. `normalized` must use the skill-aware normalizer in
 * shared-utils, NOT a generic search-key normalizer -- see that file's
 * comment on why "C#" must not collapse into "C".
 */
export const taxonomyAliases = pgTable(
  "taxonomy_aliases",
  {
    id: primaryId(),
    nodeId: uuid()
      .notNull()
      .references(() => taxonomyNodes.id, { onDelete: "cascade" }),
    alias: text().notNull(),
    normalized: text().notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("uq_taxonomy_aliases_normalized").on(t.normalized),
    index("idx_taxonomy_aliases_node").on(t.nodeId),
  ],
);

export const taxonomyEdges = pgTable(
  "taxonomy_edges",
  {
    id: primaryId(),
    fromNodeId: uuid()
      .notNull()
      .references(() => taxonomyNodes.id, { onDelete: "cascade" }),
    toNodeId: uuid()
      .notNull()
      .references(() => taxonomyNodes.id, { onDelete: "cascade" }),
    relation: taxonomyEdgeRelation().notNull(),
    /** How strongly `fromNodeId` transfers credit to `toNodeId` in matching -- e.g. Drizzle~Prisma 0.6. */
    weight: numeric({ precision: 4, scale: 3 }).notNull().default("1.000"),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("uq_taxonomy_edges_triple").on(t.fromNodeId, t.toNodeId, t.relation),
    index("idx_taxonomy_edges_from").on(t.fromNodeId),
  ],
);
