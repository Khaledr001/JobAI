import { Inject, Injectable } from "@nestjs/common";
import { asc, eq } from "drizzle-orm";
import { schema, type Db } from "@jobhunter/db";
import { DB } from "../../database/database.module.js";
import type { ListTaxonomyNodesQueryDto } from "./dto.js";

/**
 * Read-only in Phase 1 -- taxonomy is global, shared reference data (no
 * owner_id, no RLS; see taxonomy.ts's schema comment), so this never goes
 * through runAsOwner. Writing new nodes/aliases/edges (the alias-resolution
 * and proposed-node-review workflow from PLAN.md) is Phase 3's job.
 */
@Injectable()
export class TaxonomyService {
  constructor(@Inject(DB) private readonly db: Db) {}

  listNodes(query: ListTaxonomyNodesQueryDto) {
    return this.db.query.taxonomyNodes.findMany({
      where: query.kind ? eq(schema.taxonomyNodes.kind, query.kind) : undefined,
      orderBy: asc(schema.taxonomyNodes.canonicalName),
      with: { aliases: true },
    });
  }
}
