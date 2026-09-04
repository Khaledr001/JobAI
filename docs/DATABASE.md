# Database

PostgreSQL 18, Drizzle ORM, `casing: "snake_case"`.

## Roles

- `jobhunter_migrator` — owns every table, runs migrations, seed, and the
  `sql/*.sql` files. Never used at runtime.
- `jobhunter_app` — runtime role, `NOBYPASSRLS`. Cannot `UPDATE` a claim's
  `verification`/`confirmed_at`/`confirmed_by`, cannot `UPDATE` or `DELETE`
  `evidence` at all. See `packages/db/sql/01-grants.sql` for the exact
  column-level grants.

## Extensions

`pg_trgm` (fuzzy company/skill/title matching, from Phase 3 onward). `vector`
(pgvector, semantic job matching) lands with the `embeddings` table in
Phase 3+ — not enabled yet. Both are provisioned in
`docker/postgres/init/01-roles-extensions-grants.sql`.

## Row-level security (the tenancy seam)

Every owner-scoped table (everything except `users` and the global
`taxonomy_*` tables) is `ENABLE`+`FORCE ROW LEVEL SECURITY` with a single
`owner_isolation` policy comparing `owner_id` against the
`jobhunter.current_user_id` session variable (`packages/db/sql/02-rls.sql`).
There is exactly one operator today, so this has no visible effect in
practice — but it's real, not decorative, and proven in
`scripts/verify-claims-integrity.mjs`.

**Setting that session variable must go through `set_config(name, value,
true)`, never `SET LOCAL name = $1`.** `SET` does not accept a bind
parameter in that position; see `docs/DECISIONS.md` D15 and
`docs/PATTERNS.md`'s Gotchas. `packages/db/src/context.ts`'s `runAsOwner()`
is the one place this happens — always route owner-scoped queries through
it rather than opening a transaction by hand.

## The claim-ledger gate

`claims` is born unconfirmed (`confirmed_at IS NULL`). The only way it
becomes confirmed is `promote_claim(claim_id, verification, confirmed_by)`
(`packages/db/sql/04-functions.sql`), a `SECURITY DEFINER` function that
raises unless the claim has at least one `evidence` row. `jobhunter_app` has
no grant to set `verification`/`confirmed_at`/`confirmed_by` any other way.
`evidence` itself is append-only in two independent layers: no
`UPDATE`/`DELETE` grant, **and** a trigger (`sql/03-triggers.sql`) that
raises regardless of grants — deliberate redundancy per
`docs/DECISIONS.md` D2.

`v_emittable_claims` (`sql/05-views.sql`) is the only claim source a
generator (Phase 8+) may read from: confirmed, unrejected, `verification >=
'documented'`, and not blocked by an open conflict.

## The ledger → projection pattern

`work_entries` is an append-only ledger (never `DELETE`d — retract via
`retracted_at`). `technology_scores` is a **materialized projection** of it,
recomputed by `apps/api`'s `ProjectionService` from
`packages/shared-utils`'s pure `computeTechnologyScore`, never hand-edited.
See `docs/DECISIONS.md` D16 for why this runs synchronously today instead of
queued.

## Conventions

- Schema split one file per domain under `packages/db/src/schema/`;
  cross-table `relations()` (needed for Drizzle's `db.query.x.findMany({
  with: {...} })`) live together in `schema/relations.ts`.
- Numerics (`numeric` columns — scores, edge weights) come back from `pg` as
  strings; don't assume `number` without an explicit cast in the query
  layer.
- `sql/*.sql` (triggers, views, grants, RLS, and later partitions) is
  re-applied idempotently by `scripts/migrate.ts` after every `drizzle-kit`
  migration, in filename order (`01-`, `02-`, ...) — this is the escape
  hatch for anything the ORM can't express.
- A transaction's `tx` parameter must be typed via `packages/db`'s exported
  `Tx` (derived from `Db["transaction"]`), never hand-written as
  `PgTransaction<any, any, any>` — see `docs/PATTERNS.md`'s Gotchas for why
  the naive version silently breaks `tx.query.<table>` in every *consuming*
  package.

## Embeddings

One `embeddings` table (not a `vector` column per entity) keyed by
`(subject_kind, subject_id, model)`, HNSW index (`m=16, ef_construction=64`)
on `vector_cosine_ops`. Re-embedding is trigger-driven into an
`embedding_queue` table, not an in-process event bus — the writes that
invalidate an embedding come from the API, the ingest CLI, and the occasional
manual `psql` fix, and only the database sees all three. Full design in
`PLAN.md` §Embeddings; tables land in Phase 3+.

## Status

Phase 1 schema is in place (17 tables): `users`, `profiles`, `experiences`,
`projects`, `project_epochs`, `taxonomy_nodes`/`taxonomy_aliases`/
`taxonomy_edges`, `work_entries`, `work_entry_technologies`, `claims`,
`evidence`, `conflicts`/`conflict_positions`/`conflict_claims`,
`profile_versions`, `technology_scores` — plus the grants/RLS/triggers/
functions/view described above. All of it has been run for real against a
live Postgres 18 instance (schema, migrations, grants, RLS, the append-only
trigger, `promote_claim`, and `v_emittable_claims`), not just typechecked.

Not yet built: `evidence_sources` normalization, `embeddings`/
`embedding_queue` (Phase 3+), `extraction_runs`/`extraction_proposals`
(Phase 4, needs `packages/llm`), `jobs`/`applications`/everything under
Phase 5+. See [`PLAN.md`](../PLAN.md) for the full modeled schema.
