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

## `verify-no-fabrication.mjs` (live)

Loads all 21 fixtures in `packages/claims/fixtures/adversarial/*.json` and
asserts `validate()` (`packages/claims/src/validator.ts`) rejects each with
its specific expected violation code — invented technology/employer/degree/
certification, inflated tenure/outcome/proficiency, an invented team size,
a JD-mirrored bullet, a dangling/unverified/wrongly-scoped claim citation,
a plain and a homoglyph ("lеd" with a Cyrillic е) seniority upgrade, a
zero-width-space-hidden superlative, an implied employment relationship,
overlapping full-time date ranges, a version mismatch, a prompt injection
embedded in the job description, and an uncited bullet — plus the one
honest fixture, which must pass. Runs via `tsx`, importing
`packages/claims/src` **directly by relative path, not the compiled
`@jobhunter/claims` package** — this script runs before `build` in
`pnpm verify`'s pipeline, so `dist/` may not exist yet.

Sabotage-tested during implementation: temporarily replacing `validate()`
with a function that always returns `{ ok: true }` made this script fail
loudly on 20 of 21 fixtures (the honest one still "passed", correctly) —
confirming it is not a vacuous check.

## `verify-validator-mutations.mjs` (live)

For each of the seven passes (`PASS_NAMES` in `packages/claims/src/types.ts`),
disables it and re-runs every fixture tagged with that pass, requiring at
least one to flip from rejected to accepted. A pass no fixture can flip is
either dead code or fully shadowed by another pass, and fails the build
either way. Also asserts the honest fixture still passes with every pass
enabled, catching an over-broad rule. Same sabotage test as above: a
neutered `validate()` fails all seven pass-checks here too.

Designing fixtures to isolate a single pass turned out to be the hard part —
see D17/D18 in `docs/DECISIONS.md` for the two real design changes this
forced (citation-completeness's rule, and how the JD allowlist is scoped).

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
