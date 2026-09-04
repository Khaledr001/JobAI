#!/usr/bin/env node
/**
 * Phase 1: runs against real Postgres in CI (the "invariants" job, never
 * part of the dependency-free `pnpm verify`). Refuses to run if
 * DATABASE_URL points at the migrator role -- the same vacuity guard the
 * reference repo's verify-rls.mjs uses. See docs/VERIFICATION.md for the
 * ten assertions this will make once packages/db/sql/grants.sql exists.
 */
const dbUrl = process.env.DATABASE_URL ?? "";
if (dbUrl.includes("jobhunter_migrator")) {
  console.error("verify-claims-integrity: refusing to run as the migrator role.");
  process.exit(1);
}

console.warn(
  "verify-claims-integrity: STUB -- Phase 1 schema/grants do not exist yet. " +
    "This is NOT a real gate.",
);
process.exit(0);
