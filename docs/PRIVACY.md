# Privacy

This system holds a real CV, a real inbox connection, and LLM API keys for a
single operator. Treat every decision here as if the repo could go public by
accident.

## Data map

| Data | Lives | Never |
|---|---|---|
| Raw CV, generated PDFs/DOCX | Laptop only (`data/`, gitignored) | On the VPS, in the repo, in a cassette |
| Playwright session state | `data/playwright/storage-state/`, laptop only | In an image, in git, synced anywhere unencrypted |
| IMAP/LLM/S3 credentials | `.env` (laptop) or `deploy/api.env` (VPS, chmod 600) | In the PM2 ecosystem file, in git |
| Claim/evidence data | Postgres, VPS | — |
| LLM prompts (contain profile text) | Sent to DeepSeek per D11; cassettes for tests use a **synthetic** profile | Real-profile cassettes committed to git |

## What must never be committed

`.env` at any level, the real CV or any `.pdf`/`.docx`, `.dump`/`.sql.gz`,
Playwright storage state, cassettes recorded against the real profile, IMAP
app passwords. `scripts/check-privacy.mjs` checks tracked files for these on
every `pnpm verify` — but an ignore rule or a check script is not a
substitute for reading `git status` before a broad `git add`.

## Redaction

Structured logging (when added) must redact: full claim `statement` text,
document bodies, email bodies, prompts, and any field named `*password*`,
`*secret*`, `*token*`, `*apiKey*`. Never log at `info` level; if a claim or
document body needs to appear in a log for debugging, it belongs at `debug`
and only locally.

## If a key leaks

Rotate at the provider immediately, then rotate the corresponding `.env` /
`deploy/api.env` entry and redeploy. LLM keys are scoped to the worker role
only (D5), so a compromised HTTP surface alone cannot spend money — verify
that scoping wasn't accidentally widened before assuming the blast radius is
small.
