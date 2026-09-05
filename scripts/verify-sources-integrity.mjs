#!/usr/bin/env node
/**
 * Proves PLAN.md's Phase 5 dedup invariant against REAL Postgres: "a real
 * fetch inserts N; re-running inserts 0 and updates N." This is a database
 * invariant (does the partial unique index + `xmax = 0` upsert trick this
 * repo's job_canonical relies on actually behave as designed under real
 * constraints?), not application logic -- so, like verify-claims-integrity.mjs,
 * it talks to Postgres directly rather than through apps/api's Nest module
 * graph. Same vacuity guard: refuse to run if DATABASE_URL points at the
 * migrator role.
 *
 * Requires: migrations + sql/*.sql already applied (`pnpm db:migrate`)
 * against the target database, and DATABASE_URL / DATABASE_URL_MIGRATOR
 * pointing at it.
 */
import postgres from "postgres";

const appUrl = process.env.DATABASE_URL;
const migratorUrl = process.env.DATABASE_URL_MIGRATOR;

if (!appUrl || !migratorUrl) {
  console.error(
    "verify-sources-integrity: DATABASE_URL and DATABASE_URL_MIGRATOR are both required.",
  );
  process.exit(1);
}
if (appUrl.includes("jobhunter_migrator") || appUrl === migratorUrl) {
  console.error(
    "verify-sources-integrity: refusing to run -- DATABASE_URL points at the migrator role.",
  );
  process.exit(1);
}

const app = postgres(appUrl, { max: 1 });

let failures = 0;
function fail(name, detail) {
  failures++;
  console.error(`  FAIL  ${name}${detail ? ` -- ${detail}` : ""}`);
}
function pass(name) {
  console.log(`  ok    ${name}`);
}

/** Mirrors JobsService.ingestFromAdapter's three upserts exactly -- same conflict targets, same xmax-based insert/update tell. */
async function ingestOne(
  tx,
  { sourceJobId, payloadHash, rawPayload, company, title, location, description, url },
) {
  const now = new Date();
  const [rawRow] = await tx`
    INSERT INTO job_raw (provider, source_job_id, payload_hash, raw_payload, fetched_at)
    VALUES ('greenhouse', ${sourceJobId}, ${payloadHash}, ${JSON.stringify(rawPayload)}::jsonb, ${now})
    ON CONFLICT (provider, source_job_id, payload_hash) DO NOTHING
    RETURNING id
  `;
  let rawId, rawInserted;
  if (rawRow) {
    rawId = rawRow.id;
    rawInserted = true;
  } else {
    rawInserted = false;
    [{ id: rawId }] = await tx`
      SELECT id FROM job_raw
      WHERE provider = 'greenhouse' AND source_job_id = ${sourceJobId} AND payload_hash = ${payloadHash}
    `;
  }

  const dedupKey = `${company.toLowerCase()}|${title.toLowerCase()}|${(location ?? "").toLowerCase()}`;
  const [canonicalRow] = await tx`
    INSERT INTO job_canonical (dedup_key, company, title, location, description, url, first_seen_at, last_seen_at)
    VALUES (${dedupKey}, ${company}, ${title}, ${location}, ${description}, ${url}, ${now}, ${now})
    ON CONFLICT (dedup_key) WHERE closed_at IS NULL
    DO UPDATE SET
      title = EXCLUDED.title, location = EXCLUDED.location, description = EXCLUDED.description,
      url = EXCLUDED.url, last_seen_at = EXCLUDED.last_seen_at, updated_at = now()
    RETURNING id, (xmax = 0) AS inserted
  `;

  await tx`
    INSERT INTO job_source_listing (canonical_id, provider, source_job_id, raw_id, first_seen_at, last_seen_at)
    VALUES (${canonicalRow.id}, 'greenhouse', ${sourceJobId}, ${rawId}, ${now}, ${now})
    ON CONFLICT (provider, source_job_id)
    DO UPDATE SET canonical_id = EXCLUDED.canonical_id, raw_id = EXCLUDED.raw_id, last_seen_at = EXCLUDED.last_seen_at, updated_at = now()
  `;

  return { rawInserted, canonicalInserted: canonicalRow.inserted };
}

async function main() {
  const runId = Date.now();
  const listings = [0, 1].map((i) => ({
    sourceJobId: `verify-sources-integrity-${runId}-${i}`,
    payloadHash: `hash-${runId}-${i}-v1`,
    rawPayload: { id: `${runId}-${i}`, title: `Fixture Job ${i}` },
    // The dedup key is company+title+location, so ALL THREE must be unique
    // per script invocation (not just sourceJobId/payloadHash) or a second
    // separate run of this script would collide with the previous run's
    // still-open job_canonical row -- runId makes each invocation distinct.
    company: `Verify Sources Integrity Co ${runId}`,
    title: `Fixture Job ${i}`,
    location: "Remote",
    description: "A fixture job used only by verify-sources-integrity.mjs.",
    url: `https://example.invalid/jobs/${runId}-${i}`,
  }));

  // Run 1: a real fetch. Every listing is new -> N raw inserts, N canonical inserts.
  const run1 = await app.begin(async (tx) => {
    const results = [];
    for (const listing of listings) results.push(await ingestOne(tx, listing));
    return results;
  });
  if (run1.every((r) => r.rawInserted && r.canonicalInserted)) {
    pass(
      `run 1 (first fetch): ${listings.length} job_raw inserted, ${listings.length} job_canonical inserted`,
    );
  } else {
    fail("run 1 (first fetch)", JSON.stringify(run1));
  }

  // Run 2: re-running the identical fetch (same payload hash). Must insert
  // 0 new job_raw rows and 0 new job_canonical rows -- every one is an update.
  const run2 = await app.begin(async (tx) => {
    const results = [];
    for (const listing of listings) results.push(await ingestOne(tx, listing));
    return results;
  });
  if (run2.every((r) => !r.rawInserted && !r.canonicalInserted)) {
    pass(
      `run 2 (identical re-fetch): 0 job_raw inserted, 0 job_canonical inserted (both updated in place)`,
    );
  } else {
    fail("run 2 (identical re-fetch)", JSON.stringify(run2));
  }

  // Run 3: the same jobs, but the source payload changed (a real edit --
  // different payload_hash). job_raw must APPEND a new row (never overwrite
  // history) while job_canonical still updates the same row (never
  // duplicates), since the dedup key (company+title+location) is unchanged.
  const changed = listings.map((l) => ({
    ...l,
    payloadHash: `${l.payloadHash}-changed`,
    // title/company/location unchanged on purpose -- the dedup key must
    // still match run 1/2's job_canonical row; only the payload and
    // description (a real edit to the posting) differ.
    description: "An updated fixture job description.",
  }));
  const run3 = await app.begin(async (tx) => {
    const results = [];
    for (const listing of changed) results.push(await ingestOne(tx, listing));
    return results;
  });
  if (run3.every((r) => r.rawInserted && !r.canonicalInserted)) {
    pass(
      `run 3 (payload changed): ${listings.length} new job_raw rows appended, 0 new job_canonical rows (updated in place)`,
    );
  } else {
    fail("run 3 (payload changed)", JSON.stringify(run3));
  }

  const [{ count: rawCount }] = await app`
    SELECT count(*)::int AS count FROM job_raw WHERE source_job_id LIKE ${`verify-sources-integrity-${runId}-%`}
  `;
  if (rawCount === listings.length * 2) {
    pass(
      `job_raw retains both payload versions per job (${rawCount} rows total -- append-only, never overwritten)`,
    );
  } else {
    fail(
      "job_raw retains both payload versions per job",
      `expected ${listings.length * 2}, got ${rawCount}`,
    );
  }

  const [{ count: canonicalCount }] = await app`
    SELECT count(*)::int AS count FROM job_canonical WHERE url LIKE ${`https://example.invalid/jobs/${runId}-%`}
  `;
  if (canonicalCount === listings.length) {
    pass(
      `job_canonical never duplicated across all 3 runs (${canonicalCount} row(s), matching ${listings.length} distinct jobs)`,
    );
  } else {
    fail(
      "job_canonical never duplicated across all 3 runs",
      `expected ${listings.length}, got ${canonicalCount}`,
    );
  }

  // No cleanup: job_raw is append-only with no exceptions (same as
  // evidence -- see D24). job_canonical/job_source_listing have no DELETE
  // grant either -- a job is closed via closedAt, never row-deleted, the
  // same "never delete, only soft-state-change" shape as claims/conflicts
  // -- so there is no allowed path to remove these rows, by design. They
  // stay, clearly marked by their sourceJobId prefix and an .invalid URL,
  // exactly like verify-claims-integrity.mjs's own fixture rows.
}

try {
  await main();
} catch (err) {
  console.error("verify-sources-integrity: unexpected error during setup:", err);
  failures++;
} finally {
  await app.end({ timeout: 3 });
}

console.log();
if (failures > 0) {
  console.error(`verify-sources-integrity: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log(
  "verify-sources-integrity: ok -- job dedup/upsert invariants hold against real Postgres.",
);
