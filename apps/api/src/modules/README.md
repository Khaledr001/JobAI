# API modules

One folder per bounded context. Each contains exactly:

    <module>/
    ├── <module>.module.ts      # wiring
    ├── <module>.controller.ts  # HTTP only -- validate, delegate, return
    ├── <module>.service.ts     # business logic
    ├── dto.ts                  # types (Zod schemas once a route needs input validation)
    └── <module>.service.spec.ts

No CQRS, no repositories, no `entities/`. Services query `@jobhunter/db`
directly and throw `AppError` (`@jobhunter/shared-utils`), never
`HttpException` -- a service is called from a queue processor as often as
from a controller.

**`health/` is the reference implementation** for the file shape; **`claims/`
is the reference implementation** for the anti-fabrication gate pattern
(propose unconfirmed → attach evidence → `promote_claim()`). Read both
before writing a new module.

## Status

| Module         | Phase | Status  | Responsibility                                                                |
| -------------- | ----- | ------- | ----------------------------------------------------------------------------- |
| `health`       | 0     | ✅ done | Liveness (`/health`) and readiness (`/ready`) probes                          |
| `auth`         | 1     | ✅ done | Single-operator login (no signup), stateless JWT refresh                      |
| `profile`      | 1     | ✅ done | My Work -- profile, experiences, projects, project epochs                     |
| `work`         | 1     | ✅ done | Work-entry ledger, technology tagging, the projection job (D14)               |
| `taxonomy`     | 1     | ✅ done | Read-only technology/skill node lookup (D14); writes land in Phase 3          |
| `claims`       | 1     | ✅ done | The claim ledger and evidence; `promote_claim()` is the only gate             |
| `conflicts`    | 1     | ✅ done | List/resolve conflicting claims; nothing to resolve until Phase 3 seeds any   |
| `llm`          | 4     | ✅ done | Provider calls, cassettes, cost accounting, budget guard                      |
| `gap-analysis` | 4     | ✅ done | Read-only: verified profile vs. a pasted JD, matched/missing technologies     |
| `jobs`         | 5     | ✅ done | Greenhouse+Lever ingest, dedup upsert (`job_raw`/`job_canonical`)             |
| `matching`     | 6-7   | ✅ done | Wires `@jobhunter/matching` to real data; ranked projects citing work entries |
| `documents`    | 8     | ✅ done | Generator loop, validate() in the write path, real PDF/DOCX rendering         |
| `applications` | 9     | ✅ done | State machine (DB-trigger-gated), immutable approval snapshot + checksums     |
| `email`        | 10    | ⬜ todo | IMAP read-only ingest, thread linking, follow-up drafts                       |
| `analytics`    | 11    | ⬜ todo | Outcome rates, feedback into source priority                                  |
| `contacts`     | 12    | ⬜ todo | OPTIONAL -- recruiter/company behaviour, derived from `email`                 |

## Rules

1. **Nothing this system produces may assert a fact absent from the verified claim ledger.** See root `CLAUDE.md` and `docs/VERIFICATION.md`.
2. Services throw `AppError`, not `HttpException`.
3. Controllers hold no logic.
4. `process.env` is read in `config/env.ts` and nowhere else (ESLint-enforced; `app.module.ts`'s `PROCESS_ROLE` read is the one documented exception).
5. A prompt is code: it lives in `prompts/`, is reviewed, and has a cassette.
