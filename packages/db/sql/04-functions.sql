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
