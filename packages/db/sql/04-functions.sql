-- The ONLY path by which a claim's verification/confirmed_at/confirmed_by
-- columns change (sql/01-grants.sql denies jobhunter_app a direct UPDATE on
-- them). SECURITY DEFINER so it can perform that UPDATE despite the caller
-- lacking the grant -- the function's own body is the gate, not the
-- caller's privileges.

CREATE OR REPLACE FUNCTION public.promote_claim(
  p_claim_id uuid,
  p_verification public.verification,
  p_confirmed_by uuid
)
RETURNS public.claims
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim public.claims;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.evidence WHERE claim_id = p_claim_id) THEN
    RAISE EXCEPTION 'promote_claim: claim % has no evidence', p_claim_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.claims
  SET verification = p_verification,
      confirmed_at = now(),
      confirmed_by = p_confirmed_by,
      updated_at = now()
  WHERE id = p_claim_id
    AND rejected_at IS NULL
  RETURNING * INTO v_claim;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'promote_claim: claim % not found or already rejected', p_claim_id;
  END IF;

  RETURN v_claim;
END;
$$;

-- Ownership: SECURITY DEFINER functions run with the privileges of their
-- OWNER, which is whichever role ran this file -- packages/db/scripts/
-- migrate.ts always connects as jobhunter_migrator, so that's the owner here.
REVOKE ALL ON FUNCTION public.promote_claim(uuid, public.verification, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_claim(uuid, public.verification, uuid) TO jobhunter_app;

-- PLAN.md's database-level backstop for the whole anti-fabrication system
-- (docs/DECISIONS.md D1/D2): fabrication must be *unstorable*, not merely
-- rejected by application code. This is the third of the three independent
-- layers (the pure `@jobhunter/claims` validator and the write path being
-- the other two) -- if a bug in apps/api ever let an ungrounded span reach
-- an INSERT, this trigger is what actually stops it landing in the
-- database. NOT security definer: it runs as whichever role is inserting
-- (jobhunter_app in production), so it sees exactly the same
-- `v_emittable_claims` rows RLS would show that role in that transaction --
-- no privilege escalation, no bypass surface.
--
-- References public.v_emittable_claims, which sql/05-views.sql (applied
-- immediately after this file, both before this function is ever called)
-- defines -- plpgsql function bodies aren't validated against referenced
-- objects at CREATE FUNCTION time, only at execution time, so the
-- forward reference here is safe.
CREATE OR REPLACE FUNCTION public.document_spans_validate_citations()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_claim_id uuid;
  v_claim public.v_emittable_claims;
  v_generated_at timestamptz;
BEGIN
  IF NEW.kind = 'bullet' AND cardinality(NEW.claim_ids) = 0 THEN
    RAISE EXCEPTION 'document_spans: a bullet span must cite at least one claim (document %)', NEW.document_id
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT generated_at INTO v_generated_at FROM public.documents WHERE id = NEW.document_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'document_spans: document % does not exist', NEW.document_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  FOREACH v_claim_id IN ARRAY NEW.claim_ids
  LOOP
    SELECT * INTO v_claim FROM public.v_emittable_claims WHERE id = v_claim_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'document_spans: claim % is not emittable (unconfirmed, rejected, below documented, or blocked by an open conflict) or does not exist', v_claim_id
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF v_claim.confirmed_at > v_generated_at THEN
      RAISE EXCEPTION 'document_spans: claim % was confirmed after this document was generated -- promoting a claim later cannot retroactively legitimise an already-generated document', v_claim_id
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS document_spans_check_citations ON public.document_spans;
CREATE TRIGGER document_spans_check_citations
  BEFORE INSERT ON public.document_spans
  FOR EACH ROW
  EXECUTE FUNCTION public.document_spans_validate_citations();

-- PLAN.md Phase 9's state machine, enforced at the DB level as the second
-- of two independent gates (the first being ApplicationsService's own
-- check against @jobhunter/shared-utils' APPLICATION_TRANSITIONS -- the
-- exact same transition set, mirrored here by hand; see that file's
-- comment on why there is no single source both read from). Only fires
-- when `status` actually changes (the WHEN clause on the trigger below),
-- so an ordinary update to some other column is never affected.
CREATE OR REPLACE FUNCTION public.applications_validate_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT (
    (OLD.status = 'discovered' AND NEW.status = 'matched') OR
    (OLD.status = 'matched' AND NEW.status = 'drafted') OR
    (OLD.status = 'drafted' AND NEW.status = 'approved') OR
    (OLD.status = 'approved' AND NEW.status = 'applied') OR
    (OLD.status = 'applied' AND NEW.status IN ('replied', 'ghosted', 'rejected')) OR
    (OLD.status = 'replied' AND NEW.status IN ('interviewing', 'rejected')) OR
    (OLD.status = 'interviewing' AND NEW.status IN ('offer', 'rejected', 'ghosted'))
  ) THEN
    RAISE EXCEPTION 'applications: illegal status transition % -> % for application %', OLD.status, NEW.status, OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS applications_check_transition ON public.applications;
CREATE TRIGGER applications_check_transition
  BEFORE UPDATE ON public.applications
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.applications_validate_transition();
