# Decisions

Numbered, append-only. Once a decision is here, change it by adding a new
entry that supersedes it — don't edit history.

| # | Decision |
|---|---|
| D1 | **The claim ledger is the only source of truth.** No document may assert anything absent from `v_emittable_claims`. |
| D2 | **Anti-fabrication is deterministic, not an LLM judge**, enforced in three places: the pure validator, the write path, and a DB trigger. |
| D3 | **Drizzle, not Prisma.** Matches both reference backends (DevsFleet POS, ISP Management). |
| D4 | Two DB roles (`jobhunter_migrator`, `jobhunter_app`) plus column-level grants; the app role cannot promote a claim or delete evidence. |
| D5 | **One app, two entrypoints** (`apps/api/src/{main,worker}.ts`), not a separate worker app — keeps the flat-module convention and avoids any cross-app import existing at all. Revisit only if worker load genuinely needs independent scaling/deploys. |
| D6 | **API-only job sources.** No LinkedIn/Bayt/GulfTalent adapter — their terms forbid it. Reached only via `apps/assist`, manually, in a human-driven session. |
| D7 | Email is read-only ingest plus drafts; there is no automatic send path (`SMTP_SEND_ENABLED=false` by default). |
| D8 | LLM cassettes are recorded against a **synthetic** profile, never the real CV; `LLM_MODE=replay` in CI with no API keys present. |
| D9 | **VPS hosting** for Postgres/Redis/api/web; the real CV, generated PDFs, and Playwright session state stay on the laptop only. |
| D10 | `@nestjs/bullmq` with repeatable jobs, not `@nestjs/schedule` — a cron in two processes (api + worker) fires twice. |
| D11 | LLM provider is **DeepSeek** (`v4-flash` bulk, `v4-pro` finalists), behind a provider abstraction in `packages/llm`. |
| D12 | Embeddings are **local** (`fastembed`, `bge-small-en-v1.5`, 384d) — DeepSeek has no embeddings endpoint, and this keeps the CV off third-party embedding APIs. |
| D13 | `apps/api` builds and runs via `@nestjs/cli` (`nest build`/`nest start --watch`), not `tsx`. `tsx`'s esbuild-based transform silently breaks constructor-injection DI (no `design:paramtypes` metadata emitted) — confirmed by a real `Cannot read properties of undefined` crash on boot. See `docs/PATTERNS.md`. |
| D14 | `work` (work entries, technology tagging, the projection job) and `taxonomy` (read-only node lookup) are separate API modules from `profile`, not folded into it. The original sketch listed only `profile`/`claims`/`conflicts` for Phase 1; splitting them out keeps each module's controller/service to one bounded context, matching the flat-module convention's intent rather than its literal original list. |
| D15 | The RLS session variable is set with `SELECT set_config('jobhunter.current_user_id', $1, true)`, never `SET LOCAL name = $1`. `SET` does not accept a bind parameter in that position — every owner-scoped write failed with a Postgres syntax error until this was caught by running a real write against real Postgres (unit tests, which mock the DB layer, could not have caught it). See `docs/PATTERNS.md`. |
| D16 | The technology-scores projection (`ProjectionService.recomputeTechnologies`) runs synchronously, inline in the same transaction as the work-entry write that triggers it — not queued. There is no BullMQ/Redis job infrastructure in `apps/api` until Phase 4 (`packages/llm`), and at this system's real write volume (one operator logging entries by hand) a scoped recompute is imperceptible. A nightly full-owner pass to account for pure time-decay (no new entries, but `recencyScore` still drifts as time passes) is a Phase 4+ scheduling concern. |

## Still open

- Adzuna UAE (`ae`) coverage unconfirmed — needs an API key to check.
- Whether `Khaled's Bio Data.pdf`'s SSC/HSC records get manually entered (the file itself is excluded from import — third-party PII).
