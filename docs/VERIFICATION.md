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

## `verify-claims-integrity.mjs` (stub — Phase 1)

Will run against real Postgres in CI: as the app role, attempt to promote a
claim, delete evidence, or insert a span citing a non-emittable claim — each
must fail. Refuses to run at all if `DATABASE_URL` points at the migrator
role (the vacuity guard). Needs the Phase 1 schema and grants to exist first.

## Cassettes

`packages/llm` — `LLM_MODE=replay` in tests and CI, never falls through to a
live call on a cache miss. Cassettes are recorded against a **synthetic**
profile, never the real CV.

## Nightly live smoke (Phase 3+)

Hits each real job-source API once and diffs response *shape* against the
recorded fixture. Allowed to fail (`continue-on-error: true`) — its job is
to warn that a provider changed schema before ingestion silently drops jobs.
It is the one CI job permitted to be red.
