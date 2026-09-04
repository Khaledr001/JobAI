-- Runs once, on first container init (docker-entrypoint-initdb.d), as the
-- POSTGRES_USER (jobhunter_migrator, the table-owning role). Re-applied
-- idempotently by packages/db/scripts/migrate.ts after every migration, the
-- same way the reference repo re-applies sql/rls.sql.

CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- fuzzy company/skill/title matching
CREATE EXTENSION IF NOT EXISTS vector;    -- pgvector, for semantic job matching

-- The runtime application role. NOBYPASSRLS: it must go through row-level
-- security like any other client, never around it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'jobhunter_app') THEN
    CREATE ROLE jobhunter_app LOGIN PASSWORD 'app_dev_password' NOBYPASSRLS;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE jobhunter TO jobhunter_app;
GRANT USAGE ON SCHEMA public TO jobhunter_app;

-- Table/column-level grants for jobhunter_app are issued by
-- packages/db/sql/grants.sql once the schema exists (a fresh DB has no
-- tables yet when this init script runs). See docs/DATABASE.md.
