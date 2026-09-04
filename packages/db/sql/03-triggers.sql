-- Second, independent layer behind sql/01-grants.sql's missing UPDATE/DELETE
-- grant on evidence: even if that grant is ever loosened by mistake (a
-- future migration, a manual `GRANT ALL`), this trigger still raises. Two
-- mechanisms enforcing the same invariant is deliberate redundancy, not
-- accidental duplication -- see docs/DECISIONS.md D2 ("enforced in three
-- independent places").

CREATE OR REPLACE FUNCTION public.evidence_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'evidence is append-only: % is not permitted on public.evidence', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END
$$;

DROP TRIGGER IF EXISTS evidence_no_mutate ON public.evidence;
CREATE TRIGGER evidence_no_mutate
  BEFORE UPDATE OR DELETE ON public.evidence
  FOR EACH ROW
  EXECUTE FUNCTION public.evidence_append_only();
