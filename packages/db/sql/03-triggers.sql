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

-- Same two-layer append-only pattern as evidence, for job_raw (PLAN.md's
-- "rawPayload + payloadHash always retained" -- see schema/jobs.ts).
CREATE OR REPLACE FUNCTION public.job_raw_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'job_raw is append-only: % is not permitted on public.job_raw', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END
$$;

DROP TRIGGER IF EXISTS job_raw_no_mutate ON public.job_raw;
CREATE TRIGGER job_raw_no_mutate
  BEFORE UPDATE OR DELETE ON public.job_raw
  FOR EACH ROW
  EXECUTE FUNCTION public.job_raw_append_only();

-- Same two-layer append-only pattern, for document_spans (PLAN.md Phase 8:
-- a generated document's citations are historical fact once written --
-- see schema/documents.ts). Citation VALIDATION (every claim_id must exist,
-- be emittable, and predate generation) is a separate concern, a separate
-- trigger, in sql/04-functions.sql -- this one only forbids mutation.
CREATE OR REPLACE FUNCTION public.document_spans_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'document_spans is append-only: % is not permitted on public.document_spans', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END
$$;

DROP TRIGGER IF EXISTS document_spans_no_mutate ON public.document_spans;
CREATE TRIGGER document_spans_no_mutate
  BEFORE UPDATE OR DELETE ON public.document_spans
  FOR EACH ROW
  EXECUTE FUNCTION public.document_spans_append_only();

-- Same two-layer append-only pattern, for application_transitions (PLAN.md
-- Phase 9: the audit trail of what actually happened to a real
-- application is historical fact once recorded -- see schema/applications.ts).
CREATE OR REPLACE FUNCTION public.application_transitions_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'application_transitions is append-only: % is not permitted on public.application_transitions', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END
$$;

DROP TRIGGER IF EXISTS application_transitions_no_mutate ON public.application_transitions;
CREATE TRIGGER application_transitions_no_mutate
  BEFORE UPDATE OR DELETE ON public.application_transitions
  FOR EACH ROW
  EXECUTE FUNCTION public.application_transitions_append_only();
