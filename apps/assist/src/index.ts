/**
 * Playwright, headed, laptop-only -- NEVER deployed to the VPS (D9). This is
 * the only place in the monorepo allowed to import `playwright`
 * (scripts/check-boundaries.mjs enforces this). Reads a job board using the
 * operator's own logged-in session, never submits an application, and never
 * auto-retries a run -- retrying a blocked session is how accounts get
 * flagged. See PLAN.md §Job ingestion, tier 3, and ASSIST_SITE_ALLOWLIST in
 * .env.example.
 *
 * Phase 13 (optional) implements the real adapters. This stub exists so the
 * app boundary and its package.json dependency on `playwright` are in place
 * from day one, rather than bolted on later.
 */
function main() {
  if (process.env.ASSIST_ENABLED !== "true") {
    console.log("ASSIST_ENABLED is not 'true' -- refusing to start. See .env.example.");
    process.exit(1);
  }
  console.log("apps/assist: not yet implemented (Phase 13, optional).");
}

main();
