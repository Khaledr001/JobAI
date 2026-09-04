# Roadmap

Full phase detail, acceptance tests, and estimates: [`PLAN.md`](../PLAN.md).
This file tracks status only.

| # | Phase | Status |
|---|---|---|
| 0 | Scaffold | ✅ done (`pnpm verify` green; see note) |
| 1 | Claim ledger + My Work ⭐ | ✅ done (see note) |
| 2 | Anti-fabrication validator | ✅ done (see note) |
| 3 | Seed + ingest + conflicts | ⬜ todo |
| 4 | LLM layer + first AI feature (gap analysis) | ⬜ todo |
| 5 | Job ingestion (Greenhouse/Lever → Adzuna → free feeds) | ⬜ todo |
| 6 | Matching (deterministic + LLM explanation) | ⬜ todo |
| 7 | Dashboard | ⬜ todo |
| 8 | Tailored documents | ⬜ todo |
| 9 | Approval + applications | ⬜ todo |
| 10 | Email + follow-up | ⬜ todo |
| 11 | Analytics feedback loop | ⬜ todo |
| 12 | Recruiter intelligence — **optional** | ⬜ todo |
| 13 | Assisted apply (Playwright) — **optional** | ⬜ todo |

**Note on Phase 0**: verified end-to-end (`pnpm install`, `pnpm verify`,
`apps/api`'s e2e suite, and a manual worker boot + clean `SIGTERM` shutdown
via `PROCESS_ROLE=worker`) in the environment that scaffolded it. The one
piece not exercised there was `docker compose up` itself — that session's
shell couldn't reach the Docker daemon (a local permissions issue, not a
config problem: `docker compose config` parses the file correctly). Run
`pnpm infra:up && pnpm db:migrate` once to confirm Postgres/Redis/MinIO
actually come up clean on this machine.

**Note on Phase 1**: verified end-to-end against a real, live PostgreSQL 18
instance (this machine's own `psql`-managed cluster, not the Docker
service — Docker access was unavailable in that session; the schema is
identical either way). Concretely proven, not just typechecked: the full
migration + `sql/*.sql` (grants, RLS, triggers, `promote_claim`,
`v_emittable_claims`) applied cleanly; all 9 checks in
`scripts/verify-claims-integrity.mjs` passed; the real API booted, and a
full HTTP round trip was exercised by hand — login, `GET /profile`, listing
seeded taxonomy nodes, creating a work entry tagged with two technologies
and confirming `technology_scores` computed the exact expected
recency/depth/breadth/composite values, and the full claim lifecycle
(create → confirm-with-no-evidence correctly rejected → attach evidence →
confirm succeeds → appears in `v_emittable_claims` → reject). That process
of actually running it surfaced and fixed two real bugs no unit test caught
(D15's `SET LOCAL` vs `set_config`, and a DTO silently dropping
`sourceKind`/`sourceRef`) — see `docs/DECISIONS.md`.

**Note on Phase 2**: `packages/claims/src/validator.ts` implements all seven
passes for real (citation completeness, citation resolution, quantity
containment, entity closure + JD-echo, seniority/superlative lexicon,
employment implication, timeline coherence), against a 21-fixture
adversarial corpus (one more than PLAN.md's "~20" — an extra fixture was
needed to isolate citation-completeness in the mutation harness; see D18).
`scripts/verify-no-fabrication.mjs` and `scripts/verify-validator-mutations.mjs`
are both real now, not stubs, and `pnpm verify` is green end-to-end
including them. Both were sabotage-tested by temporarily neutering
`validate()` to always return `{ ok: true }`: `verify-no-fabrication`
correctly failed 20 of 21 checks, and `verify-validator-mutations` failed
all 7 pass-checks — proving neither is a vacuous gate. Two real design
issues surfaced only by writing the fixtures, not by reading the code — see
D17 and D18 in `docs/DECISIONS.md`.

Known gap, deliberately not blocking phase progression: Phase 1's
"Add-Work UI" deliverable (a page in `apps/web` to add a work entry and see
recent work / technology scores) was not built — Phase 1 was verified
against the API directly (`curl`/HTTP), not through a browser. The backend
endpoints it would call already exist (`work`, `profile`, `taxonomy`
modules). Worth picking up before or alongside Phase 7 (Dashboard), which
needs the same API surface.

## Cross-cutting, not phase-bound

- `docs/DECISIONS.md` grows as real decisions are made — append, never edit history.
- `scripts/verify-*` stubs get filled in as their owning phase lands (see `docs/VERIFICATION.md`).
