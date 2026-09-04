-- Every generator query (Phase 8+) goes through this view -- one definition,
-- one place to be right about what's safe to cite. See docs/DECISIONS.md D1.

CREATE OR REPLACE VIEW public.v_emittable_claims AS
SELECT c.*
FROM public.claims c
WHERE c.rejected_at IS NULL
  AND c.confirmed_at IS NOT NULL
  AND c.verification >= 'documented'::public.verification
  AND NOT EXISTS (
    SELECT 1
    FROM public.conflict_claims cc
    JOIN public.conflicts f ON f.id = cc.conflict_id
    WHERE cc.claim_id = c.id
      AND f.status = 'open'
      AND f.blocks_emission
  );

-- Views do not inherit the base table's RLS policies automatically in the
-- way a casual reader might expect -- but Postgres DOES apply the querying
-- role's RLS policies on the view's underlying tables at execution time
-- (views run with the privileges of the querying role by default, i.e. NOT
-- security_barrier/definer here), so owner_isolation on `claims` still
-- applies to whoever selects from this view.
GRANT SELECT ON public.v_emittable_claims TO jobhunter_app;
