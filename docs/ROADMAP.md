# Roadmap

Full phase detail, acceptance tests, and estimates: [`PLAN.md`](../PLAN.md).
This file tracks status only.

| # | Phase | Status |
|---|---|---|
| 0 | Scaffold | ✅ done (`pnpm verify` green; see note) |
| 1 | Claim ledger + My Work ⭐ | ✅ done (see note) |
| 2 | Anti-fabrication validator | ✅ done (see note) |
| 3 | Seed + ingest + conflicts | ✅ done (see note) |
| 4 | LLM layer + first AI feature (gap analysis) | ✅ done (see note) |
| 5 | Job ingestion (Greenhouse/Lever → Adzuna → free feeds) | ✅ done, Greenhouse+Lever only (see note) |
| 6 | Matching (deterministic + LLM explanation) | ✅ done, deterministic scorer only (see note) |
| 7 | Dashboard | ✅ done, real data end-to-end (see note) |
| 8 | Tailored documents | ✅ done, real data end-to-end (see note) |
| 9 | Approval + applications | ✅ done, state machine + snapshot real (see note) |
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

**Note on Phase 3**: `tools/ingest` runs for real against the six real
source files/repos on this machine (resume.md, the portfolio, work-log.txt,
both dated `PROJECT_DOCUMENTATION.md` copies, and three git repos across
two Inventra epochs), not fixtures. Real output, after `finalize`:
4 experiences, 6 projects (Inventra and Mazarini correctly consolidated
across sources that name them differently — see D22/D23), 243 work
entries, 114 confirmed claims (91 `attested`, 23 `documented`), 23
emittable, 4 correctly left unconfirmed. All three conflicts PLAN.md
predicted as reachable from these sources fired exactly as designed:

- **Mazarini module count** — a genuine *four-way* disagreement (PLAN.md
  expected three): resume.md (5+), the portfolio (15+), and two dated
  copies of `PROJECT_DOCUMENTATION.md` that disagree with each other about
  a milestone already in the past by the time either was written (27, then
  32). Correctly classified `definition` (not `count`) since "modules" and
  "content_types" are different units, and blocks emission.
- **Telemedicine role** — real, dated work in the portfolio, absent from
  resume.md entirely. `coverage_gap`, non-blocking.
- **Igala** — a real project (work-log.txt, a live project directory)
  published nowhere. `coverage_gap`, non-blocking.

The two conflicts PLAN.md said would *not* yet materialize (the 30%-vs-40%
latency claim, the four-way Bizreflex end date) correctly did not: both
depend on PDF/LinkedIn sources this phase deliberately doesn't ingest, and
this system treats that as working as intended, not a gap.

Running it for real, against real data, surfaced four bugs no dry-run or
type-check caught — see D20–D24 in `docs/DECISIONS.md`: a Docker image
missing the pgvector extension it needs, a nested-transaction self-deadlock
that hung a live run for 30 minutes under `poolMax=1`, an em-dash/hyphen
split bug that truncated "Non-Profit Organization" to "Non", and the
operator's real email addresses ending up in a tracked documentation file
(caught by `check-privacy.mjs` itself, then fixed by moving the git-identity
allowlist into `.env`). A cross-source entity-resolution gap (the same
employer named "Bright Technology Limited" in one source and "Bright
Technology Ltd" in another, creating a duplicate `experiences` row) was
found and fixed the same way project-slug aliasing already fixed Inventra;
the one duplicate row already written was cleaned up by *rejecting* the
duplicate claim and deleting the redundant experience row — not by deleting
evidence, which the `evidence_append_only` trigger correctly refused even
for a Postgres superuser.

**Note on Phase 4**: `packages/llm` is real -- `DeepSeekProvider` (real
`fetch` to `https://api.deepseek.com/chat/completions`), `withCassette`
(record/replay, sha256-keyed on provider/model/temperature/seed/messages/schema),
`estimateCostUsd` (DeepSeek's cache-hit/cache-miss token split, peak-hour
2x multiplier), and `BudgetGuard` (throws at or above the daily cap) --
22 tests, all passing. `apps/api/src/modules/llm/llm.service.ts` is the
one place every feature calls DeepSeek through: it checks
`getSpentTodayUsd` against the budget guard *before* calling the wrapped
provider, then records every call (tokens, cost, cassette mode) to the new
`llm_calls` table (append-only grant, owner-scoped RLS). The wrapped
provider is injected via a DI token (`LLM_PROVIDER`) rather than
constructed inline in the service -- see D26 -- which is what let
`llm.service.spec.ts` (4 tests) exercise the real budget-gate-before-call
ordering with a fake provider, no cassette file needed.

The first feature, `gap-analysis` (`POST /gap-analysis`), is deliberately
read-only: it builds a prompt from `v_emittable_claims` (the exact gate
Phase 8's resume generator will also read from) plus a pasted job
description wrapped and labeled as untrusted input, and Zod-`.strict()`-
validates whatever comes back before returning it. 4 tests, all passing.

All of this was proven against real infrastructure, not just typechecked:
the compiled app was booted against the live database with `LLM_MODE=replay`
and no `DEEPSEEK_API_KEY` set (this repo's actual `.env` -- i.e. Phase 4's
literal acceptance-test environment) and driven over real HTTP with a
minted JWT for the real operator. Three things were confirmed by log
inspection, not assumption: (1) a normal request correctly read 22 real,
live `documented` claims out of `v_emittable_claims` and built the exact
expected prompt; (2) with no matching cassette, it failed with precisely
the cassette-miss error and re-record instructions -- never a live call;
(3) with `LLM_DAILY_BUDGET_USD=0`, it threw a clean `400` before the
cassette lookup ever ran. A cassette was then hand-crafted once to prove
the full happy path (real claims read → cassette hit → schema-validated
response → cost written to `llm_calls`, confirmed via
`GET /llm/spend-today` reflecting the recorded cost) -- and deleted
immediately after, since matching the real request's cache key meant it
necessarily contained the real operator's real claim data. See D25–D27.

An incidental finding while doing this manual verification: an ad hoc
`psql` session querying `v_emittable_claims` directly (without first
setting `jobhunter.current_user_id`) saw zero rows for the real operator,
even filtered by his exact `owner_id` -- not a data problem, but
`verify-claims-integrity.mjs`'s own "a transaction with no owner context
sees zero rows (RLS fail-safe)" invariant working exactly as designed.

**Note on Phase 5**: `packages/sources` has real Greenhouse and Lever
adapters (`boards-api.greenhouse.io`, `api.lever.co` -- both public,
unauthenticated tier-1 APIs, verified live against real boards, Sept
2026), a plain-text sanitizer for Greenhouse's double-HTML-entity-escaped
`content` field, and a `strongDedupKey()` (company+title+location). 25
tests, all against real recorded fixtures (a trimmed real Mixpanel
Greenhouse board, a real 3-posting Gynger Lever board) -- MockAgent from
PLAN.md's original sketch was swapped for an injected `fetchImpl`, matching
`packages/llm`'s own `deepseek.spec.ts` precedent for the same shape of
problem (D28). Only Greenhouse and Lever landed this phase, per PLAN.md's
own instruction to do "one adapter end-to-end before writing a second" --
Adzuna and the free feeds are next, not started.

`packages/db/src/schema/jobs.ts` adds `company_ats`/`job_raw`/
`job_canonical`/`job_source_listing`, global reference data with no RLS
(D29) -- `job_raw` append-only via the same two-layer pattern as `evidence`,
confirmed against real Postgres the same way D24 confirmed it for evidence
(both the app role and a superuser session were refused). `apps/api`'s new
`jobs` module (`POST /jobs/ingest`, `GET /jobs`) does the dedup upsert via
an `xmax = 0` insert/update tell (D30).

Proven twice against real infrastructure, not just typechecked:
`scripts/verify-sources-integrity.mjs` (synthetic fixture rows, rerunnable,
excluded from `pnpm verify` like `verify-claims-integrity.mjs` since it
needs real Postgres) proves the three-run dedup story end to end --
insert, no-op re-fetch, and a payload change that appends to `job_raw`
without duplicating `job_canonical`. Separately, the compiled app was
booted against the real database and `POST /jobs/ingest` was called twice,
back to back, against Greenhouse's real public Mixpanel board: first call
`{discovered: 84, rawInserted: 84, canonicalInserted: 84}`, second call
(same board, no changes) `{discovered: 84, rawInserted: 0, rawSkipped: 84,
canonicalInserted: 0, canonicalUpdated: 84}` -- exactly PLAN.md's acceptance
test, against the real API and the real code path, not a mock. Those 84
real postings were left in the database (public job listings, no privacy
concern, unlike Phase 4's LLM cassette) as genuine proof-of-concept
content rather than deleted as test debris.

Known gaps, deliberately not blocking phase progression: no `fetchDetail`
(Greenhouse's `content=true` already returns full descriptions inline, so
nothing needs it yet -- would matter once application-question drafting,
Phase 9, needs Greenhouse's `questions=true` detail endpoint); no
`company_ats` registry rows written yet (the `POST /jobs/ingest` route
takes a provider+boardToken directly rather than looking one up -- wiring
a registry-driven scheduled fan-out is a BullMQ/queue concern, intentionally
deferred past this phase, see PLAN.md's Queues section); no repost/
`supersedesId` linking exercised (would need a job to actually close and
reappear >45 days later, which real data can't demonstrate on demand).

**Note on Phase 6**: `packages/matching` is real and pure -- `gates.ts`
(Stage 0: location/authorization and excluded-stack gates, free, run
before any scoring), `coverage.ts` + `score.ts` (Stage 1: single-hop
graph-expanded `stackFit`, plus `recencyFit`/`seniorityFit`/`domainOverlap`,
all four sub-scores surviving to the explanation rather than blended
away), and `explain.ts` (ties gates+score into `MatchExplanation`,
`headline` bounded 0-100 by construction). 28 unit/property tests, all
passing: the literal PLAN.md gate example (an onsite Toronto job with no
sponsorship, candidate authorized only in the UAE) is gated, not scored;
monotonicity (adding a matched technology, or raising a matched
technology's composite score, never lowers `headline`); permutation
invariance (reordering `technologies` arrays changes nothing); bounded
0-100 across a spread of edge cases; and the citation-safety property PLAN.md
names explicitly -- every `matched[].via` traces back to a real entry in
the candidate's own technologies, never invented.

`verify:golden` (new, wired into `pnpm verify`) byte-compares 15
hand-authored, real-taxonomy-grounded profile x job pairs against frozen
expected output (`packages/matching/golden/*.json`, generated once via
`packages/matching/scripts/generate-golden.mjs`) -- 15, not PLAN.md's
sketched 50, the same kind of honest reduction Phase 2 documented for its
own fixture count (D18). Sabotage-tested the same way Phase 2's validator
was: temporarily breaking the headline weights (so they summed above 1)
correctly flipped 11 of 15 cases to a mismatch, proving the gate is real,
not vacuous (D32).

Also seeded: 23 real `taxonomy_edges` (`packages/db/scripts/seed.ts`)
against the real 31-node taxonomy Phase 3's ingest produced, applied to
the live database and confirmed via `psql` -- PLAN.md's own warning that
an empty edge graph makes every non-exact match silently score 0 (D34).

Known gaps, deliberately not blocking phase progression (D35): no
LLM-based JD-requirements parsing yet (the scorer's `JobRequirements`
input is accepted pre-structured; producing it from a real
`job_canonical.description` -- deterministically or via an LLM -- is
separate follow-up work); no `apps/api` `matching` module wiring real
ingested jobs through the scorer end-to-end; no `computedYears`
derivation (`experienceYears` is a plain input, not computed from
non-overlapping work ranges); no Stage 2 LLM judgment layer; no
`search_profiles`. None of these are required by Phase 6's stated
acceptance test.

**Note on Phase 7**: closes D35's deferred gap first -- a new `apps/api`
`matching` module (`MatchingService`) wires Phase 6's pure scorer to real
data: a deterministic keyword-scan requirement extractor
(`requirement-extraction.ts`, 7 tests), real `technology_scores`/
`taxonomy_edges`/`experiences` for the candidate side, and a new
`relevantProjects` enrichment (ranked real projects each citing a real
work entry, PLAN.md's literal acceptance-test phrase). Then the actual
dashboard: `apps/web` gained a real bearer-JWT auth flow (`/login`,
`localStorage`, `useAuthGuard`), a Jobs list, a job detail page (matched ✓
with JD quote / missing ⚠ / ranked projects), a My Work page (technology
scores + recent work entries), and a Conflicts page with a working
resolve action -- `next build` type-checks and statically generates all
7 routes.

Two real, non-obvious bugs surfaced by testing against real data rather
than fixtures, both fixed and documented as decisions:

- **`technology_scores` was empty for the real operator** despite 243 real
  work entries and 184 real technology taggings existing -- Phase 3's bulk
  ingest never triggers the projection recompute the ordinary API write
  path calls. Every real job match was scoring every required technology
  MISSING regardless of real, confirmed work. Fixed with a reusable,
  idempotent backfill script, not a one-off query (D36).
- **A false-positive requirement match**: the taxonomy alias "next" (for
  Next.js) matched the plain English phrase "the next step" in a real
  Greenhouse posting; "ts" (TypeScript) had the same risk. Both aliases
  were removed from the seed and deleted from the already-seeded
  `taxonomy_aliases` table.

After both fixes, a real live Mixpanel posting ("Senior Software Engineer,
AI Product Insights") scored 79/100 ("worth_applying"), correctly citing
the operator's real TypeScript/React work and correctly ranking real
projects (Chat Application, Mazarini, Inventra, ...) each citing a real,
dated work entry -- the exact shape PLAN.md's acceptance test describes.

Known gap, disclosed rather than assumed away: **no browser was used to
verify the frontend.** This session has no browser-automation tool
available. Verification that *was* done: `next build`'s own type-check
and static-generation pass for all 7 routes, `next lint` clean, a booted
`next dev` server returning 200 for every route with `CHOKIDAR_USEPOLLING`/
`WATCHPACK_POLLING` set (this mount's inotify gap, root CLAUDE.md), the
`/login` route's server-rendered HTML containing its real form markup,
and confirming via server logs that every route compiles and serves
without a runtime exception. What was **not** verified: that the pages
render correctly after client-side hydration, that TanStack Query's
requests actually populate the DOM as designed, or any interactive flow
(logging in, clicking "resolve", the token round-trip) in an actual
browser. This should be the first thing done, by a human or a
browser-capable session, before trusting this dashboard beyond the API
contracts it's built on.

Known gaps, deliberately not blocking phase progression: the Jobs page
is one undifferentiated list -- PLAN.md's recommended/new/saved/rejected
tabs need a per-operator job status this system doesn't have until Phase
9's applications state machine exists. No pagination anywhere (fine at
current real data volume: 90 jobs, 243 work entries).

**Note on Phase 8**: the full generator loop from PLAN.md's diagram is real
-- `apps/api`'s new `documents` module reads `v_emittable_claims`, drafts
via `LlmService` (v4-pro), runs the draft through `@jobhunter/claims`'
real `validate()` in the write path, retries once with violations appended
to the prompt on failure, and only then renders (real `pdfkit`/`docx`,
D39) and persists. Three independent anti-fabrication layers, all real and
all proven: the pure validator (Phase 2's 21 fixtures), the write path
(this phase's retry-then-reject logic, unit-tested against the literal
acceptance-test scenario -- a fabricated skill correctly produces
`UNSUPPORTED_ENTITY` and, uncorrected, a `DOCUMENT_VALIDATION_FAILED`
error carrying the violations), and a new DB trigger on `document_spans`
(D40) proven against real Postgres by extending `verify-claims-integrity.mjs`
exactly as `docs/VERIFICATION.md` had flagged it would need to be.

Verified against real infrastructure end-to-end, not just unit-tested: the
compiled app was booted against the live database with `LLM_MODE=replay`
and no `DEEPSEEK_API_KEY` (this repo's actual `.env`), and a real
`POST /documents/generate` against a real ingested Mixpanel job correctly
read real emittable claims and failed with the expected cassette-miss
error. A cassette was then hand-crafted once (as in Phase 4/6, and deleted
immediately after for the same reason -- D27 -- since matching the real
request hash necessarily embedded real claim data) to prove the full happy
path: a real PDF (`file` confirms `PDF document, version 1.3`) and a real
DOCX (`file` confirms `Microsoft Word 2007+`) were rendered and written to
`data/generated/<ownerId>/`, and the resulting `documents`/`document_spans`
rows were persisted and passed the new DB trigger for real. Crafting that
cassette surfaced a second real bug, fixed the same session: the
`v_emittable_claims` queries in both `gap-analysis` and `documents`
ordered by `subject` alone, which has no tiebreaker for the real duplicate
subjects in this operator's data (e.g. two "PostgreSQL" claims from two
repos) -- fixed by ordering `subject, id` (D42).

Known gaps, deliberately not blocking phase progression: no claim-by-claim
diff UI in `apps/web` yet (the acceptance test's substance -- citation
enforcement -- is proven at the API/DB level; a dashboard page to view a
generated document's spans is real, scoped follow-up, not started); no S3/
MinIO (D43 -- local disk is the deliberate, permanent choice per D9, not a
stand-in); no custom font embedding (D39); documents are generated
one-shot via a direct endpoint, not queued (matches this system's actual
write volume, same reasoning as D16).

**Note on Phase 9**: `apps/api`'s new `applications` module is the real
state machine from PLAN.md -- `ApplicationsService` gates every status
change against `APPLICATION_TRANSITIONS` (D44), and a mirrored DB trigger
(`applications_validate_transition`) is the second, independent
enforcement layer, proven against real Postgres by extending
`verify-claims-integrity.mjs` again (7 new checks, following the exact
"extend this script when that table lands" pattern `docs/VERIFICATION.md`
set for `document_spans` in Phase 8). Approval (`drafted -> approved`)
freezes an immutable snapshot: sha256 checksums of the actual rendered
bytes read fresh off disk (D47), the deduped claim set cited, and the
model/prompt-version/cassette-key that produced them (`documents.cassetteKey`,
captured at generation time via a newly-exported `computeCassetteKey`, D46).

Verified against real infrastructure end-to-end, not just unit-tested: the
compiled app was booted against the live database, and a real application
was created against the real Mixpanel job used in Phase 8's own
verification, then walked through `discovered → matched → drafted →
approved → applied` over real HTTP, reusing that phase's real, already-
generated PDF/DOCX. The approval response's `snapshotChecksumPdf`/
`snapshotChecksumDocx` were confirmed to exactly match an independent
`sha256sum` of the actual files on disk -- PLAN.md's literal "snapshot
byte-identical to the downloaded PDF" acceptance test, proven, not
asserted. The illegal transition PLAN.md names explicitly
(`applied → drafted`) was then confirmed rejected twice, independently: a
`409 ILLEGAL_APPLICATION_TRANSITION` from the real HTTP endpoint (the
service-level gate), and separately a raw SQL `UPDATE` as the app role,
bypassing the service entirely, correctly refused by the DB trigger.

One real migration wrinkle, fixed in place: `documents` already had one
real row (Phase 8's own verification) when this phase added a `NOT NULL
cassette_key` column to it -- a bare `ADD COLUMN ... NOT NULL` would have
failed against that row, and the naive fix (a blind backfill `UPDATE`)
silently affected zero rows under RLS (this table's RLS applies to the
migrator role too, D-series precedent from Phase 4). Fixed by disabling
RLS for the one backfill statement, immediately re-enabled by `sql/02-rls.sql`
which runs unconditionally right after.

Known gaps, deliberately not blocking phase progression (D48): no
Greenhouse `questions=true` answer drafting (a genuinely separate feature,
not exercised by this phase's acceptance test); no `apps/web` UI for the
state machine yet (creating/transitioning an application is proven at the
API/DB level; a dashboard page to drive it by hand is real, scoped
follow-up); no automatic `discovered` creation when a job is ingested (an
operator explicitly starts tracking a job today, matching this system's
single-operator, manual-review scale).

**Closed (2026-09-05)**: Phase 1's "Add-Work UI" deliverable — long carried
here as a known gap — is built. `/work` now has a real Add Work form
(`apps/web/src/components/work/add-work-form.tsx`) covering every field of
`CreateWorkEntrySchema`, plus per-row retraction behind a two-step confirm.
Proven end-to-end against the live API and real Postgres, not just
type-checked: creating an entry tagged `NATS` with source evidence moved that
technology's real composite score 0.4327 → 0.7075 (projectCount 0 → 1,
monthsActive 0 → 14); re-posting the same body with different whitespace and
a different title returned `CONFLICT` carrying `details.workEntryId` (the
form renders that case specifically); retracting reverted the score to
0.4327 exactly. The test row was hard-deleted afterwards — the ledger is back
to its real 243 entries with zero retracted rows.

Two things the form makes visible that the API cannot: the `sourceKind` /
`sourceRef` pair is enforced as both-or-neither client-side, and a live
"caps at attested/documented" badge shows the verification ceiling the
current field values imply — the difference between an entry that can reach
a resume and one that never will. Both behaviours are read off
`packages/shared-utils`' own projection spec, not guessed.

Still not built, and still real follow-up work: editing `profile`,
`experiences`, and `projects` from the browser (those endpoints exist and
are exercised only by `curl` today), and any UI for the `claims` write path
(`POST /claims`, `/evidence`, `/confirm`, `/reject`).

**Known data pollution, not yet cleaned (found 2026-09-05)**:
`scripts/verify-claims-integrity.mjs` and `scripts/verify-sources-integrity.mjs`
each `INSERT` a fixture row into the real `job_canonical` table and **never
delete it**. `verify-sources-integrity.mjs` even makes its company name unique
per run (`Verify Sources Integrity Co ${runId}`) specifically so a second run
won't collide with the first — which guarantees the table grows by one junk
company on every invocation. Today that's 4 of the 50 rows in `/jobs`
("Verify Co" ×2, "Verify Sources Integrity Co …" ×2) against 46 real Mixpanel
postings, and they now surface on the dashboard's "Latest postings". The fix
is for each script to delete its own fixture in a `finally`; the existing rows
need a one-off cleanup. Not done unilaterally — deleting rows from the real
jobs table is the operator's call.

## Open bugs found during the first live-LLM run (2026-09-05)

**1. The matcher scores 100/"strong" when it extracts zero requirements.**
`packages/matching/src/score.ts:65-66` reads `totalWeight === 0 ? 1 : …`, so a
job description that yields no extracted requirements gets `stackFit`,
`recencyFit`, `seniorityFit` and `domainOverlap` all defaulting to `1.0` —
headline **100**, band **strong**, `matched: [] missing: []`. Measured against
real data: **43 of 46** real Mixpanel postings score a vacuous 100, including
sales, HR and finance roles. The clearest case is "Software Engineer, AI
Platform", which scores 100 while the LLM gap analysis on the *same posting*
found 0 matched and 8 missing required skills (LLMs, agent orchestration,
vector search, eval frameworks — none of which exist in the 31-node taxonomy,
so the keyword extractor of D38 finds nothing). For a system whose Rule #1 is
that absence of evidence must never become a positive claim, "no requirements
found" defaulting to a perfect score is that rule inverted. Needs: an explicit
`insufficient_data` band (or a gate) distinct from `strong`, so the dashboard
cannot present an unscoreable job as a great match.

**2. Dead LLM env vars.** `LLM_TIMEOUT_MS` and `LLM_MAX_TOKENS` are set in
`.env` and read nowhere in the codebase (see D57). Either wire them into
`DeepSeekProvider` (the `timeoutMs` option now exists for exactly this) or
delete them — as-is they make the system look configured when it isn't.

**3. `deepseek-v4-*` are reasoning models and bill reasoning as output.** A
single flash call spent 8,232 completion tokens of which 7,978 were
`reasoning_tokens`. The cost model in PLAN.md (~4k in / 1.2k out per JD parse)
does not account for this; real per-call cost is meaningfully higher than
budgeted.

## Cross-cutting, not phase-bound

- `docs/DECISIONS.md` grows as real decisions are made — append, never edit history.
- `scripts/verify-*` stubs get filled in as their owning phase lands (see `docs/VERIFICATION.md`).
