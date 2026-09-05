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

  // --- document_spans (Phase 8) -- docs/VERIFICATION.md flagged this gap
  // explicitly before the table existed: "extend this script when that
  // table lands, per the same pattern." ---

  let documentId;
  await runAsApp(async (tx) => {
    [{ id: documentId }] = await tx`
      INSERT INTO documents (owner_id, kind, file_path_pdf, file_path_docx, model, prompt_version, cassette_key)
      VALUES (${ownerId}, 'resume', '/tmp/probe.pdf', '/tmp/probe.docx', 'deepseek-v4-pro', 'documents-v1', 'probe-cassette-key')
      RETURNING id
    `;
  });
  console.log(`Document fixture ready: document=${documentId}`);

  await expectSuccess("app role can INSERT a bullet span citing an emittable claim", () =>
    runAsApp(
      (tx) => tx`
        INSERT INTO document_spans (document_id, owner_id, kind, text, claim_ids, "order")
        VALUES (${documentId}, ${ownerId}, 'bullet', 'Used NestJS in production.', ARRAY[${claimId}]::uuid[], 0)
      `,
    ),
  );

  await expectError(
    "a bullet span with zero claim_ids is rejected (trigger)",
    () =>
      runAsApp(
        (tx) => tx`
          INSERT INTO document_spans (document_id, owner_id, kind, text, claim_ids, "order")
          VALUES (${documentId}, ${ownerId}, 'bullet', 'An uncited bullet.', ARRAY[]::uuid[], 1)
        `,
      ),
    (err) => /must cite at least one claim/i.test(err.message),
  );

  // A "draft" claim: real row, real subject, never confirmed -- exactly the
  // shape PLAN.md's acceptance test means by "citing a draft claim".
  let draftClaimId;
  await runAsApp(async (tx) => {
    [{ id: draftClaimId }] = await tx`
      INSERT INTO claims (owner_id, kind, subject, statement)
      VALUES (${ownerId}, 'used_technology', 'Kubernetes', 'Used Kubernetes in production.')
      RETURNING id
    `;
  });
  await expectError(
    "a span citing an unconfirmed (draft) claim is rejected (trigger)",
    () =>
      runAsApp(
        (tx) => tx`
          INSERT INTO document_spans (document_id, owner_id, kind, text, claim_ids, "order")
          VALUES (${documentId}, ${ownerId}, 'bullet', 'Used Kubernetes in production.', ARRAY[${draftClaimId}]::uuid[], 1)
        `,
      ),
    (err) => /not emittable/i.test(err.message),
  );

  await expectError(
    "a span citing a nonexistent claim id is rejected (trigger)",
    () =>
      runAsApp(
        (tx) => tx`
          INSERT INTO document_spans (document_id, owner_id, kind, text, claim_ids, "order")
          VALUES (${documentId}, ${ownerId}, 'bullet', 'Cites nothing real.', ARRAY['00000000-0000-0000-0000-000000000000']::uuid[], 1)
        `,
      ),
    (err) => /not emittable/i.test(err.message),
  );

  // Backdating: a claim confirmed AFTER the document's generated_at cannot
  // legitimise a span on that already-generated document, even though the
  // claim itself is (now) genuinely emittable.
  await runAsApp(async (tx) => {
    await tx`
      INSERT INTO evidence (owner_id, claim_id, kind, locator)
      VALUES (${ownerId}, ${draftClaimId}, 'git_commit', 'def5678')
    `;
    await tx`SELECT * FROM promote_claim(${draftClaimId}::uuid, 'documented'::verification, ${ownerId}::uuid)`;
  });
  await expectError(
    "a span citing a claim confirmed AFTER document generation is rejected (no retroactive backdating)",
    () =>
      runAsApp(
        (tx) => tx`
          INSERT INTO document_spans (document_id, owner_id, kind, text, claim_ids, "order")
          VALUES (${documentId}, ${ownerId}, 'bullet', 'Used Kubernetes in production.', ARRAY[${draftClaimId}]::uuid[], 1)
        `,
      ),
    (err) => /confirmed after this document was generated/i.test(err.message),
  );

  const [{ id: firstSpanId }] = await runAsApp(
    (tx) =>
      tx`SELECT id FROM document_spans WHERE document_id = ${documentId} ORDER BY "order" LIMIT 1`,
  );
  await expectError(
    "app role cannot UPDATE document_spans (grant + trigger)",
    () =>
      runAsApp(
        (tx) => tx`UPDATE document_spans SET text = 'tampered' WHERE id = ${firstSpanId}`,
      ),
    (err) => /permission denied|append-only/i.test(err.message),
  );
  await expectError(
    "app role cannot DELETE document_spans (grant + trigger)",
    () => runAsApp((tx) => tx`DELETE FROM document_spans WHERE id = ${firstSpanId}`),
    (err) => /permission denied|append-only/i.test(err.message),
  );

  // --- applications (Phase 9) -- same "extend this script" pattern as
  // document_spans above. job_canonical is global (no owner_id), so the
  // fixture job is created directly, not through runAsApp. ---

  const [{ id: fixtureJobId }] = await migrator`
    INSERT INTO job_canonical (dedup_key, company, title, location, description, url, first_seen_at, last_seen_at)
    VALUES (${`verify-claims-integrity-${Date.now()}`}, 'Verify Co', 'Fixture Role', 'Remote', 'A fixture job.', 'https://example.invalid/fixture', now(), now())
    RETURNING id
  `;

  let applicationId;
  await runAsApp(async (tx) => {
    [{ id: applicationId }] = await tx`
      INSERT INTO applications (owner_id, job_id, status)
      VALUES (${ownerId}, ${fixtureJobId}, 'discovered')
      RETURNING id
    `;
  });
  console.log(
    `Application fixture ready: application=${applicationId} job=${fixtureJobId}`,
  );

  await expectSuccess(
    "app role can UPDATE applications through a legal transition (discovered -> matched)",
    () =>
      runAsApp(
        (tx) =>
          tx`UPDATE applications SET status = 'matched' WHERE id = ${applicationId}`,
      ),
  );

  await expectError(
    "app role cannot UPDATE applications through an illegal transition, skipping a state (matched -> approved)",
    () =>
      runAsApp(
        (tx) =>
          tx`UPDATE applications SET status = 'approved' WHERE id = ${applicationId}`,
      ),
    (err) => /illegal status transition/i.test(err.message),
  );

  await runAsApp(async (tx) => {
    await tx`UPDATE applications SET status = 'drafted' WHERE id = ${applicationId}`;
    await tx`UPDATE applications SET status = 'approved' WHERE id = ${applicationId}`;
    await tx`UPDATE applications SET status = 'applied' WHERE id = ${applicationId}`;
  });
  pass("app role can walk a real application through discovered -> ... -> applied");

  await expectError(
    // PLAN.md's literal acceptance-test example.
    "app role cannot UPDATE applications from applied back to drafted (trigger)",
    () =>
      runAsApp(
        (tx) =>
          tx`UPDATE applications SET status = 'drafted' WHERE id = ${applicationId}`,
      ),
    (err) => /illegal status transition/i.test(err.message),
  );

  await runAsApp(
    (tx) => tx`UPDATE applications SET status = 'rejected' WHERE id = ${applicationId}`,
  );
  await expectError(
    "app role cannot UPDATE applications out of a terminal state (rejected -> matched)",
    () =>
      runAsApp(
        (tx) =>
          tx`UPDATE applications SET status = 'matched' WHERE id = ${applicationId}`,
      ),
    (err) => /illegal status transition/i.test(err.message),
  );

  const [{ id: firstTransitionId }] = await runAsApp(async (tx) => {
    await tx`INSERT INTO application_transitions (application_id, owner_id, from_status, to_status) VALUES (${applicationId}, ${ownerId}, 'discovered', 'matched')`;
    return tx`SELECT id FROM application_transitions WHERE application_id = ${applicationId} LIMIT 1`;
  });
  await expectError(
    "app role cannot UPDATE application_transitions (grant + trigger)",
    () =>
      runAsApp(
        (tx) =>
          tx`UPDATE application_transitions SET note = 'tampered' WHERE id = ${firstTransitionId}`,
      ),
    (err) => /permission denied|append-only/i.test(err.message),
  );
  await expectError(
    "app role cannot DELETE application_transitions (grant + trigger)",
    () =>
      runAsApp(
        (tx) => tx`DELETE FROM application_transitions WHERE id = ${firstTransitionId}`,
      ),
    (err) => /permission denied|append-only/i.test(err.message),
  );

  // No cleanup of the fixture user/claim/evidence/document/document_spans/
  // application_transitions: evidence, document_spans, and
  // application_transitions are append-only with no exceptions, including
  // for a cascaded DELETE from a dropped user -- confirmed above, and that
  // refusal is correct, not a bug to work around here. The fixture email is
  // timestamped so repeated local runs never collide; in CI this runs
  // against disposable Postgres anyway.
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
