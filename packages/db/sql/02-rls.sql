-- Row-level security -- the "tenancy seam" from docs/DECISIONS.md. There is
-- exactly one operator today, so this has no visible effect in practice,
-- but it is real and enforced, not aspirational: every owner-scoped table
-- is FORCE ROW LEVEL SECURITY, and the policy is proven in CI by
-- scripts/verify-claims-integrity.mjs, the same way the reference repo
-- proves its RLS with verify-rls.mjs.
--
-- The app must SET LOCAL jobhunter.current_user_id = '<uuid>' at the start
-- of every transaction -- see packages/db/src/context.ts's runAsOwner(). A
-- transaction that never sets it sees zero rows in every owner-scoped
-- table, which is the fail-safe direction.
--
-- The policy is granted TO jobhunter_app AND jobhunter_migrator, matching
-- the reference repo's own pattern (its tenant_isolation policy lists both
-- roles). Today jobhunter_migrator is the Postgres image's initial
-- POSTGRES_USER, which is created as a superuser and so bypasses RLS
-- unconditionally regardless of this policy -- but promote_claim()
-- (sql/04-functions.sql) is SECURITY DEFINER and runs AS whichever role
-- owns it, which is always jobhunter_migrator today. If that role is ever
-- demoted from superuser (the more conventional setup, and arguably safer),
-- FORCE ROW LEVEL SECURITY would then apply to it too, and without this
-- explicit grant promote_claim would silently see zero rows. Including it
-- now costs nothing and removes a footgun for that future change. SET LOCAL
-- is transaction-scoped, not role-scoped, so the session variable the
-- caller set is visible to the function regardless of which role executes.
--
-- Explicitly EXCLUDED: `users` (its own id is the identity, not something it
-- is "owned by") and the taxonomy_* tables (global, shared reference data --
-- see taxonomy.ts's comment on why they carry no owner_id at all).

DO $$
DECLARE
  owner_scoped_table text;
  owner_scoped_tables text[] := ARRAY[
    'profiles', 'experiences', 'projects', 'project_epochs',
    'work_entries', 'work_entry_technologies',
    'claims', 'evidence',
    'conflicts', 'conflict_positions', 'conflict_claims',
    'technology_scores', 'profile_versions'
  ];
BEGIN
  FOREACH owner_scoped_table IN ARRAY owner_scoped_tables
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', owner_scoped_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', owner_scoped_table);
    EXECUTE format(
      'DROP POLICY IF EXISTS owner_isolation ON public.%I',
      owner_scoped_table
    );
    EXECUTE format(
      $p$CREATE POLICY owner_isolation ON public.%I
         FOR ALL TO jobhunter_app, jobhunter_migrator
         USING (owner_id = NULLIF(current_setting('jobhunter.current_user_id', true), '')::uuid)
         WITH CHECK (owner_id = NULLIF(current_setting('jobhunter.current_user_id', true), '')::uuid)$p$,
      owner_scoped_table
    );
  END LOOP;
END
$$;
