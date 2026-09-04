# Database

PostgreSQL 18, Drizzle ORM, `casing: "snake_case"`.

## Roles

- `jobhunter_migrator` — owns every table, runs migrations and seed. Never
  used at runtime.
- `jobhunter_app` — runtime role, `NOBYPASSRLS`. Cannot `UPDATE` a claim's
  verification/confirmation columns, cannot `DELETE` from `evidence` — see
  `packages/db/sql/grants.sql` (added in Phase 1) for the exact grants.

## Extensions

`pg_trgm` (fuzzy company/skill/title matching), `vector` (pgvector, semantic
job matching). Both enabled in `docker/postgres/init/01-roles-extensions-grants.sql`.

## Conventions

- Schema split one file per domain under `packages/db/src/schema/`.
- Numerics come back from `pg` as strings; don't assume `number` without an
  explicit cast in the query layer.
- `sql/*.sql` (triggers, views, grants, and later partitions) is re-applied
  idempotently by `scripts/migrate.ts` after every `drizzle-kit` migration —
  this is the escape hatch for anything the ORM can't express.

## Embeddings

One `embeddings` table (not a `vector` column per entity) keyed by
`(subject_kind, subject_id, model)`, HNSW index (`m=16, ef_construction=64`)
on `vector_cosine_ops`. Re-embedding is trigger-driven into an
`embedding_queue` table, not an in-process event bus — the writes that
invalidate an embedding come from the API, the ingest CLI, and the occasional
manual `psql` fix, and only the database sees all three. Full design in
`PLAN.md` §Embeddings; tables land in Phase 3+.

## Status

Schema is currently empty — Phase 0 only wires the connection and migration
runner. The claim ledger (`profile`, `experience`, `projects`, `work_entries`,
`taxonomy`, `evidence`, `claims`, `conflicts`) is Phase 1. See
[`PLAN.md`](../PLAN.md) for the full modeled schema.
