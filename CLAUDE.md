# AI Job Hunter

Personal, single-operator system: "My Work" (a verified, evidence-backed claim
ledger) is the source of truth for what the operator can do _right now_. Job
postings are ingested, parsed, and matched against it; tailored resumes are
generated and validated so **nothing unverified can ever be emitted**.

Full design: [`docs/DECISIONS.md`](docs/DECISIONS.md) (why),
[`docs/PATTERNS.md`](docs/PATTERNS.md) (how), [`docs/ROADMAP.md`](docs/ROADMAP.md)
(what's built). Read the specific doc you need — do not read this whole tree
to get oriented; the docs exist so you don't have to.

## Rule #1

**Nothing this system produces may assert a fact absent from the verified
claim ledger.** Enforced in three independent places: `packages/claims`'
pure validator, the write path, and a Postgres trigger. See
`docs/VERIFICATION.md` before touching anything in `packages/claims` or
`packages/matching`.

## Commands

```
pnpm install && pnpm infra:up && pnpm db:migrate   # first-time setup
pnpm dev                                            # all apps, watch mode
pnpm verify                                          # the full CI gate, locally
pnpm --filter @jobhunter/api test                    # one package/app only
```

`pnpm verify` = boundaries → privacy → typecheck → lint → test →
no-fabrication → validator-mutations → build. Run the narrowest command that
answers your question (a single `--filter`) before reaching for the full gate.

## Environment quirks (this machine, this mount)

- **This repo sits on an NTFS/fuseblk mount where inotify does not fire.**
  Every dev-mode file watcher must poll (`CHOKIDAR_USEPOLLING=1`,
  `WATCHPACK_POLLING=true`) or it will serve a silently stale build. If a
  change isn't showing up, this is why.
- `node`/`pnpm` are not on `PATH` in a non-interactive shell — source nvm
  first: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24.11.1`.
- `git` will refuse to operate here until this exact path is trusted:
  `git config --global --add safe.directory "$(pwd)"` (already done for this
  checkout; needed again only on a fresh clone).
- `PLAYWRIGHT_BROWSERS_PATH` must point outside the repo — a browser binary
  on this mount is slow to fetch and `rm -rf` fails with `ENOTEMPTY` while a
  handle is open.

## Conventions (see `docs/PATTERNS.md` for detail)

- Flat NestJS modules: `x.module.ts` / `x.controller.ts` / `x.service.ts` /
  `dto.ts` / `x.service.spec.ts`. No CQRS, no repositories, no `entities/`.
- Zod for DTOs and env validation — no class-validator, no global
  `ValidationPipe`.
- Services throw `AppError`, not `HttpException` — they're called from queue
  processors as well as controllers, where HTTP status is meaningless.
- `process.env` is read in `config/env.ts` only; ESLint enforces this.
- `packages/claims` and `packages/matching` are pure — no IO, no `Date.now()`,
  no `Math.random()`, no importing `@jobhunter/db` or `@jobhunter/llm`.
  Enforced by ESLint and `scripts/check-boundaries.mjs`.
- A prompt is code: it lives in `apps/api/src/modules/<feature>/prompts/`,
  gets reviewed, and has a cassette (`packages/llm`). Never string-concat a
  job description into a template — it's untrusted input.

## Token-consumption hygiene for future sessions in this repo

- `.gitignore` excludes `node_modules/`, `dist/`, `.next/`, `.turbo/`,
  `coverage/`, and everything under `data/` — don't `find`/`grep` those paths
  manually; if a search tool isn't respecting ignore rules, scope the search
  instead of widening it.
- Fixtures/cassettes/goldens (`packages/llm/cassettes`, `packages/sources/fixtures`,
  `packages/matching/golden`, `packages/claims/fixtures`) are data, not code —
  don't read them wholesale; look up the one case you need.
- Prefer the module's own `README.md` status table
  (`apps/api/src/modules/README.md`) over grepping the whole `modules/` tree
  to find out what's built.
- This file stays short on purpose. If you're about to add a paragraph of
  detail, it probably belongs in `docs/` with a one-line pointer added here
  instead.
