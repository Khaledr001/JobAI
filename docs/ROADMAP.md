# Roadmap

Full phase detail, acceptance tests, and estimates: [`PLAN.md`](../PLAN.md).
This file tracks status only.

| # | Phase | Status |
|---|---|---|
| 0 | Scaffold | ✅ done (`pnpm verify` green; see note) |
| 1 | Claim ledger + My Work ⭐ | ⬜ todo |
| 2 | Anti-fabrication validator | ⬜ todo |
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

## Cross-cutting, not phase-bound

- `docs/DECISIONS.md` grows as real decisions are made — append, never edit history.
- `scripts/verify-*` stubs get filled in as their owning phase lands (see `docs/VERIFICATION.md`).
