#!/usr/bin/env node
/**
 * Proves the claim-ledger invariants against REAL Postgres -- these cannot
 * be unit tested, because the thing being tested is what the database
 * itself refuses to do. Modeled on the reference repo's verify-rls.mjs,
 * including its vacuity guard: refuse to run at all if DATABASE_URL points
 * at the migrator role, so this can never silently "pass" by accident of
 * running with elevated privileges.
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
    "verify-claims-integrity: DATABASE_URL and DATABASE_URL_MIGRATOR are both required.",
  );
  process.exit(1);
}
if (appUrl.includes("jobhunter_migrator") || appUrl === migratorUrl) {
  console.error(
    "verify-claims-integrity: refusing to run -- DATABASE_URL points at the migrator role.",
  );
  process.exit(1);
}

const app = postgres(appUrl, { max: 1 });
const migrator = postgres(migratorUrl, { max: 1 });

let failures = 0;
let ownerId;
let claimId;
let evidenceId;

function fail(name, detail) {
  failures++;
  console.error(`  FAIL  ${name}${detail ? ` -- ${detail}` : ""}`);
}
function pass(name) {
  console.log(`  ok    ${name}`);
}

async function expectError(name, fn, matcher) {
  try {
    await fn();
    fail(name, "expected an error, but the statement succeeded");
  } catch (err) {
    if (matcher && !matcher(err)) {
      fail(name, `wrong error: ${err.message}`);
    } else {
      pass(name);
    }
  }
}

async function expectSuccess(name, fn) {
  try {
    await fn();
    pass(name);
  } catch (err) {
    fail(name, err.message);
  }
}

async function main() {
  // Fixture: one throwaway user, created as migrator (jobhunter_app has no
  // INSERT grant on users -- see sql/01-grants.sql).
  const emailProbe = `verify-claims-integrity-${Date.now()}@example.invalid`;
  [{ id: ownerId }] = await migrator`
    INSERT INTO users (email, password_hash, display_name)
    VALUES (${emailProbe}, 'x', 'Probe')
    RETURNING id
  `;

  // Every subsequent app-role statement runs inside a transaction with the
  // RLS session variable set -- exactly what runAsOwner() does in the app.
  const runAsApp = (fn) =>
    app.begin(async (tx) => {
      await tx`SELECT set_config('jobhunter.current_user_id', ${ownerId}, true)`;
      return fn(tx);
    });

  await runAsApp(async (tx) => {
    [{ id: claimId }] = await tx`
      INSERT INTO claims (owner_id, kind, subject, statement)
      VALUES (${ownerId}, 'used_technology', 'NestJS', 'Used NestJS in production.')
      RETURNING id
    `;
  });
  console.log(`Fixtures ready: owner=${ownerId} claim=${claimId}`);
  console.log();

  await expectError(
    "app role cannot UPDATE claims.verification directly",
    () =>
      runAsApp(
        (tx) => tx`UPDATE claims SET verification = 'measured' WHERE id = ${claimId}`,
      ),
    (err) => /permission denied/i.test(err.message),
  );

  await expectError(
    "app role cannot UPDATE claims.confirmed_at directly",
    () =>
      runAsApp((tx) => tx`UPDATE claims SET confirmed_at = now() WHERE id = ${claimId}`),
    (err) => /permission denied/i.test(err.message),
  );

  await expectError(
    "promoting a claim with zero evidence fails",
    () =>
      runAsApp(
        (tx) =>
          tx`SELECT * FROM promote_claim(${claimId}::uuid, 'documented'::verification, ${ownerId}::uuid)`,
      ),
    (err) => /has no evidence/i.test(err.message),
  );

  await runAsApp(async (tx) => {
    [{ id: evidenceId }] = await tx`
      INSERT INTO evidence (owner_id, claim_id, kind, locator)
      VALUES (${ownerId}, ${claimId}, 'git_commit', 'abc1234')
      RETURNING id
    `;
  });
  pass("app role can INSERT evidence");

  await expectError(
    "app role cannot UPDATE evidence (grant + trigger)",
    () =>
      runAsApp(
        (tx) => tx`UPDATE evidence SET locator = 'tampered' WHERE id = ${evidenceId}`,
      ),
    (err) => /permission denied|append-only/i.test(err.message),
  );

  await expectError(
    "app role cannot DELETE evidence (grant + trigger)",
    () => runAsApp((tx) => tx`DELETE FROM evidence WHERE id = ${evidenceId}`),
    (err) => /permission denied|append-only/i.test(err.message),
  );

  await expectSuccess("promoting a claim WITH evidence succeeds", () =>
    runAsApp(
      (tx) =>
        tx`SELECT * FROM promote_claim(${claimId}::uuid, 'documented'::verification, ${ownerId}::uuid)`,
    ),
  );

  const [emittable] = await runAsApp(
    (tx) => tx`SELECT * FROM v_emittable_claims WHERE id = ${claimId}`,
  );
  if (emittable) {
    pass("a confirmed, evidenced claim appears in v_emittable_claims");
  } else {
    fail(
      "a confirmed, evidenced claim appears in v_emittable_claims",
      "not found in the view",
    );
  }

  // RLS fail-safe: a transaction that never sets the session variable must
  // see zero rows in an owner-scoped table, not an error and not every row.
  const [{ count: blindCount }] =
    await app`SELECT count(*)::int AS count FROM claims WHERE id = ${claimId}`;
  if (blindCount === 0) {
    pass("a transaction with no owner context sees zero rows (RLS fail-safe)");
  } else {
    fail(
      "a transaction with no owner context sees zero rows (RLS fail-safe)",
      `saw ${blindCount} row(s)`,
    );
  }

  // No cleanup of the fixture user/claim/evidence: evidence is append-only
  // with no exceptions, including for a cascaded DELETE from a dropped user
  // -- confirmed above, and that refusal is correct, not a bug to work
  // around here. The fixture email is timestamped so repeated local runs
  // never collide; in CI this runs against disposable Postgres anyway.
}

try {
  await main();
} catch (err) {
  console.error("verify-claims-integrity: unexpected error during setup:", err);
  failures++;
} finally {
  await app.end({ timeout: 3 });
  await migrator.end({ timeout: 3 });
}

console.log();
if (failures > 0) {
  console.error(`verify-claims-integrity: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log("verify-claims-integrity: ok -- all claim-ledger invariants hold.");
