# Patterns

## Adding an API module

Copy the shape of the reference module named in
`apps/api/src/modules/README.md`. Flat folder, five files, no exceptions.
Controllers hold no logic. Services throw `AppError` (see below), never
`HttpException` — a service is called from a queue processor as often as
from a controller, and HTTP status codes are meaningless there.

## Errors

`AppError` + a shared `ERROR_CODES` map in `shared-utils`; a single
`AllExceptionsFilter` maps codes to HTTP statuses at the edge. A service
never imports `@nestjs/common`'s HTTP exceptions.

## Claims and citations

`packages/claims` is the `Money`-equivalent slot: the one place that knows
what "verified" means. Never reimplement evidence/verification logic inline
in a module — import it.

## Database

- `casing: "snake_case"` in `drizzle.config.ts`; camelCase in TypeScript.
  Numerics arrive from Postgres as strings — don't assume `number`.
- Two roles: `jobhunter_migrator` (owns tables, runs migrations) and
  `jobhunter_app` (runtime, restricted by column-level grants). Never point
  `DATABASE_URL` at the migrator outside a migration script.
- `packages/db/sql/*.sql` is the hand-written escape hatch for anything
  drizzle-kit can't generate (triggers, views, RLS-shaped grants, partitions
  later). Re-applied by `packages/db/scripts/migrate.ts` after every
  migration — idempotent by construction.

## Queues and workers

Five queues (`ingest`, `llm`, `embed`, `project`, `assist`), each scoped to
one external resource so rate-limiting has one place to live. Use
`@nestjs/bullmq` (DI-managed, participates in `enableShutdownHooks()`) and
BullMQ repeatable jobs for scheduling — never `@nestjs/schedule`, which fires
twice across the api+worker process pair.

## Prompts and cassettes

A prompt is code: it lives in `apps/api/src/modules/<feature>/prompts/`, gets
reviewed like any other diff, and has a recorded cassette. `LLM_MODE=replay`
in tests and CI; a cassette miss is a **test failure with the re-record
command in the message**, never a silent fallthrough to a live call.

## Testing

Vitest, colocated `*.spec.ts`. `packages/claims` and `packages/matching` are
pure — their specs need no database, no network, and run in the default
`pnpm test`.

## Gotchas

- **`apps/api` uses `@nestjs/cli` (`nest build` / `nest start --watch`) for
  its dev server and build, not `tsx`.** `tsx` transpiles via esbuild, which
  strips decorators without emitting `design:paramtypes` metadata — every
  constructor-injected provider resolves to `undefined` at runtime with no
  compile-time warning (confirmed: `nest start` under `tsx watch` throws
  `Cannot read properties of undefined` the moment a service injects
  `ConfigService`). This is the same class of problem `apps/api/vitest.config.ts`
  already works around with `unplugin-swc` for tests — `nest build`/`nest
  start` solve it for dev/build by compiling through `tsc` instead. Every
  other package (`packages/db/scripts`, `tools/ingest`, `apps/assist`) has no
  NestJS DI, so plain `tsx` is fine there.
- `tsconfig.base.json` has `incremental: false` for a reason — see the
  comment in that file before turning it on.
- The skill/technology matcher needs its own text normalizer, one that
  preserves `#`, `+`, `.` (`C#`, `C++`, `.NET`, `Node.js`). A generic
  search-key normalizer that strips punctuation will silently merge `C#`
  into `C`.
- **Never write an invisible Unicode character directly into source
  code** (e.g. a zero-width space in a regex character class). It cannot be
  reviewed in a diff or an editor, and in this codebase it was also
  impossible to type reliably by hand — every attempt at
  `packages/claims/src/normalize.ts` silently produced the real invisible
  byte instead of the intended escape-sequence text. The fix: build the
  pattern at runtime from numeric code points
  (`String.fromCharCode(0x200b)`, ...), never from a literal character in
  the file. A visible-but-confusable character (a Cyrillic "е" used as a
  homoglyph test fixture) is fine to write literally — the concern is
  specifically invisibility, not non-ASCII text.
- HNSW filtered vector search returns `ef_search` candidates *then* applies
  the `WHERE` — a selective filter can silently return fewer rows than
  asked. See `docs/DATABASE.md` before writing a filtered embedding query.
- **Setting a session-local RLS variable must go through `set_config(name,
  value, true)`, never `SET LOCAL name = ${value}` via a driver's tagged
  template.** `SET` is not an ordinary statement and does not accept a bind
  parameter in that position — confirmed by running it for real: every
  single write in the app failed with a Postgres syntax error
  (`SET LOCAL jobhunter.current_user_id = $1`) until `runAsOwner`
  (`packages/db/src/context.ts`) was switched to
  `SELECT set_config('jobhunter.current_user_id', ${ownerId}, true)`.
  `set_config` is an ordinary function, so it takes the value as a normal,
  safely-bound argument; its third argument (`true`) is what makes the
  setting transaction-local, equivalent to `SET LOCAL`. This is the one bug
  in Phase 1 that unit tests could not catch (they mock the DB layer) — it
  only surfaced by running a real write against real Postgres.
- **A transaction's `tx` parameter type must be derived from `Db["transaction"]`,
  never hand-written as `PgTransaction<any, any, any>`.** A conditional type
  distributes over a naked `any`, so `PgDatabase`'s internal "is the schema
  generic present" check collapses into a union that includes its own
  `DrizzleTypeError` branch, and every `tx.query.<table>` access then fails
  to typecheck — but only from a *consuming* package, since it still
  resolves fine inside `packages/db` itself. Use `packages/db`'s exported
  `Tx` type (`Parameters<Parameters<Db["transaction"]>[0]>[0]`), which
  always matches `Db` exactly.
- **`createDb`'s return type must be annotated explicitly**, not left to
  inference (`PostgresJsDatabase<typeof schema> & { $client: Sql }`).
  Leaving it inferred risks the schema generic not surviving into the
  package's emitted `.d.ts`, for the same class of reason as above.

## Frontend

Next.js App Router, client components + TanStack Query against
`apps/web/src/lib/api-client.ts`. No server actions — matches the reference
repo's convention, and keeps every data access path visible in one client.

Auth is a bearer JWT in `localStorage` (`api-client.ts`'s `getAccessToken`/
`setTokens`), attached as `Authorization: Bearer <token>` on every request —
apps/api's `JwtStrategy` only reads that header, never a cookie. Pages needing
auth call `useAuthGuard()`, which redirects to `/login` client-side after
mount (there is no middleware — this is a static-shell app).

**Import extensions differ from the rest of the repo.** `apps/api` and every
`packages/*` use explicit `.js`-suffixed relative imports (Node ESM /
`NodeNext` convention: `import { x } from "./y.js"` even though `y.ts` is
the real file). `apps/web` does **not** — it uses Next's own `bundler`
module resolution, and Turbopack's resolver does not alias a `.js` import
back to a sibling `.ts` file the way `tsc`'s `bundler` mode tolerates for
type-checking. An extension-suffixed import in `apps/web` passes `tsc
--noEmit` cleanly and then fails at `next build`/`next dev` with "Module
not found" — see docs/DECISIONS.md D37. Every `apps/web` import must be
extension-less (`"@/lib/api-client"`, `"./nav-bar"`).
