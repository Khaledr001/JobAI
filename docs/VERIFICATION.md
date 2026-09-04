# Verification

What each script in `scripts/` proves, and why it can't be an ordinary unit
test. Modeled on the reference repo's `verify-rls.mjs`: prove an invariant
against real infrastructure, and make the check itself refuse to pass
vacuously.

## `check-boundaries.mjs` (live)

No app imports another app. No `../..` escapes a package boundary.
`apps/web` may not import `@jobhunter/db` or `@jobhunter/llm`. Only
`apps/assist` may import Playwright. `packages/claims` and
`packages/matching` may not import `@jobhunter/db` or `@jobhunter/llm`.

## `check-privacy.mjs` (live)

Runs over **tracked** files (`git ls-files`), not the working tree — an
ignore rule is one `git add -f` from irrelevant. Checks: API-key-shaped
strings, a non-dev-password `postgres://user:pass@` URL, tracked
`.pdf`/`.docx`/`.dump`/`.sql.gz`, and any tracked file over 1MB that isn't
the lockfile. Operator PII patterns (real name/email/phone) are read from an
**untracked** `.privacy-patterns.local` so the patterns themselves are never
committed — absent file means skip with a loud warning, not a false pass.

## `verify-no-fabrication.mjs` (stub — Phase 2)

Will load ~20 adversarial fixtures (invented technology, inflated metric,
JD-echoed requirement, homoglyph seniority upgrade, prompt injection in the
job description, etc.) and assert `packages/claims`' validator rejects each
with its specific expected violation code, and the one honest fixture
passes. Currently exits 0 with a loud "not yet implemented" notice — it is
not yet a real gate. Do not remove it from `pnpm verify`; implement it in
Phase 2 instead.

## `verify-validator-mutations.mjs` (stub — Phase 2)

Will disable each validator rule in turn and assert the fixture corpus
detects it (a rule no fixture depends on is dead code and fails the build).
Same stub status as above.

## `verify-claims-integrity.mjs` (live — proves the following against real Postgres)

Requires migrations + `sql/*.sql` applied first (`pnpm db:migrate`). Refuses
to run at all if `DATABASE_URL` points at the migrator role (the vacuity
guard — mirrors the reference repo's `verify-rls.mjs`). As the app role,
inside a transaction with the RLS session variable set (exactly what
`runAsOwner` does):

1. `UPDATE claims SET verification = ...` fails on permission
2. `UPDATE claims SET confirmed_at = ...` fails on permission
3. `promote_claim()` on a claim with zero evidence fails
4. `INSERT INTO evidence` succeeds
5. `UPDATE`/`DELETE` on `evidence` both fail (grant **and** trigger — two
   independent mechanisms, see `sql/03-triggers.sql`)
6. `promote_claim()` on a claim *with* evidence succeeds
7. the now-confirmed claim appears in `v_emittable_claims`
8. a transaction that never sets the RLS session variable sees **zero**
   rows in `claims` — the fail-safe direction, not a silent leak

Document-span citation checks (`document_spans`, which don't exist until
Phase 8) are not covered here yet; extend this script when that table
lands, per the same pattern.

Not part of `pnpm verify` — it needs real infrastructure, so it runs in
CI's separate `invariants` job (see `.github/workflows/ci.yml`), the same
split the reference repo uses for `verify-rls.mjs`.

## Cassettes

`packages/llm` — `LLM_MODE=replay` in tests and CI, never falls through to a
live call on a cache miss. Cassettes are recorded against a **synthetic**
profile, never the real CV.

## Nightly live smoke (Phase 3+)

Hits each real job-source API once and diffs response *shape* against the
recorded fixture. Allowed to fail (`continue-on-error: true`) — its job is
to warn that a provider changed schema before ingestion silently drops jobs.
It is the one CI job permitted to be red.
