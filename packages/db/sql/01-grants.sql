-- Column-level grants for jobhunter_app -- the mechanism that makes
-- "promoting a claim with zero evidence fails" a database fact, not an
-- application convention. Re-applied idempotently after every migration by
-- scripts/migrate.ts. Safe to re-run: every statement here is a REVOKE/GRANT,
-- both idempotent by nature.
--
-- Baseline: revoke everything, then grant back exactly what jobhunter_app
-- needs. This is the opposite default from "grant everything, revoke the
-- dangerous bits" -- a table added later with no entry here is inaccessible
-- until someone deliberately grants it, which is the safer failure mode.

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('__drizzle_migrations')
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM jobhunter_app', t.tablename);
  END LOOP;
END
$$;

GRANT USAGE ON SCHEMA public TO jobhunter_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO jobhunter_app;

-- identity / profile -- ordinary CRUD, no gating needed
GRANT SELECT, UPDATE ON public.users TO jobhunter_app;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO jobhunter_app;
GRANT SELECT, INSERT, UPDATE ON public.experiences TO jobhunter_app;
GRANT SELECT, INSERT, UPDATE ON public.projects TO jobhunter_app;
GRANT SELECT, INSERT, UPDATE ON public.project_epochs TO jobhunter_app;

-- taxonomy -- shared reference data; read-heavy, written only when a new
-- node/alias/edge is proposed (never deleted by the app role)
GRANT SELECT, INSERT, UPDATE ON public.taxonomy_nodes TO jobhunter_app;
GRANT SELECT, INSERT, UPDATE ON public.taxonomy_aliases TO jobhunter_app;
GRANT SELECT, INSERT, UPDATE ON public.taxonomy_edges TO jobhunter_app;

-- work_entries -- append-only ledger. No UPDATE of historical fact columns,
-- no DELETE ever: retraction is a column write (retracted_at), not a delete.
GRANT SELECT, INSERT ON public.work_entries TO jobhunter_app;
GRANT UPDATE (retracted_at, updated_at) ON public.work_entries TO jobhunter_app;
GRANT SELECT, INSERT, DELETE ON public.work_entry_technologies TO jobhunter_app;

-- claims -- the core gate. INSERT is unrestricted (an operator may propose
-- any claim); UPDATE excludes verification/confirmed_at/confirmed_by, which
-- exist only so promote_claim() (SECURITY DEFINER, sql/functions.sql) can
-- set them after checking evidence exists. rejected_at is a safety-decreasing
-- operation (it only ever narrows v_emittable_claims), so it's fine to allow
-- directly.
GRANT SELECT, INSERT ON public.claims TO jobhunter_app;
GRANT UPDATE (subject, statement, quantities, rejected_at, updated_at) ON public.claims TO jobhunter_app;

-- evidence -- append-only, full stop. No UPDATE grant, no DELETE grant.
-- sql/03-triggers.sql adds a second, independent layer in case this grant
-- is ever loosened by mistake.
GRANT SELECT, INSERT ON public.evidence TO jobhunter_app;

-- conflicts -- resolution is a normal UPDATE (unlike claim promotion, there
-- is no evidence-existence invariant to protect here; the review UI itself
-- is the safeguard).
GRANT SELECT, INSERT, UPDATE ON public.conflicts TO jobhunter_app;
GRANT SELECT, INSERT ON public.conflict_positions TO jobhunter_app;
GRANT SELECT, INSERT, DELETE ON public.conflict_claims TO jobhunter_app;

-- profile_index -- written ONLY by the projection recompute path, which
-- runs through jobhunter_app today (Phase 1 has no separate worker-role DB
-- credential yet) but never through a route that lets a caller set an
-- arbitrary score directly -- that invariant lives in application code
-- (ProjectionService), not in these grants.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.technology_scores TO jobhunter_app;
GRANT SELECT, INSERT, UPDATE ON public.profile_versions TO jobhunter_app;

-- llm_calls -- append-only cost ledger (packages/llm's BudgetGuard reads a
-- SUM() over this; see docs/PATTERNS.md). No UPDATE, no DELETE: a cost
-- record must never be quietly edited after the fact, for the same reason
-- evidence is append-only.
GRANT SELECT, INSERT ON public.llm_calls TO jobhunter_app;
