#!/usr/bin/env node
/**
 * Proves the anti-fabrication validator's proof isn't vacuous. For each of
 * the seven passes: disable it, re-run every fixture that targets it, and
 * require at least one to flip from rejected to accepted. A pass no
 * fixture depends on is either dead code or fully shadowed by another
 * pass, and this fails the build either way -- a check that can pass
 * without checking anything is worse than no check.
 *
 * Same source-import rationale as verify-no-fabrication.mjs: runs via tsx,
 * before `build`, directly against packages/claims/src.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAdversarialFixtures } from "../packages/claims/src/fixtures.js";
import { PASS_NAMES } from "../packages/claims/src/types.js";
import { validate } from "../packages/claims/src/validator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(
  __dirname,
  "..",
  "packages",
  "claims",
  "fixtures",
  "adversarial",
);

function optionsFor(fixture, disabledPasses) {
  const options = {};
  if (fixture.jobDescription !== null) options.jobDescription = fixture.jobDescription;
  if (disabledPasses) options.disabledPasses = disabledPasses;
  return options;
}

const fixtures = loadAdversarialFixtures(FIXTURES_DIR);
let failures = 0;

for (const pass of PASS_NAMES) {
  const targeting = fixtures.filter((f) => f.pass === pass);

  if (targeting.length === 0) {
    failures++;
    console.error(
      `  FAIL  "${pass}" -- no fixture targets it; it can never be proven load-bearing`,
    );
    continue;
  }

  const flipped = targeting.some((fixture) => {
    const withPass = validate(fixture.spans, fixture.claims, optionsFor(fixture));
    const withoutPass = validate(
      fixture.spans,
      fixture.claims,
      optionsFor(fixture, [pass]),
    );
    return withPass.ok === false && withoutPass.ok === true;
  });

  if (flipped) {
    console.log(
      `  ok    "${pass}" -- disabling it flips at least one fixture to passing`,
    );
  } else {
    failures++;
    console.error(
      `  FAIL  "${pass}" -- disabling it left every targeting fixture rejected ` +
        `(dead code, or fully shadowed by another pass)`,
    );
  }
}

// The inverse check: applying the minimal honest correction to each
// rejected fixture should make it pass -- catches an over-broad rule that
// rejects everything regardless of content. "Minimal correction" here is
// simply citing every claim the fixture provides and dropping the
// fabricated content -- approximated by asserting the corpus's own single
// honest fixture (which received exactly that treatment) passes.
const honest = fixtures.find((f) => f.expectedCode === null);
if (!honest) {
  failures++;
  console.error(`  FAIL  no honest (always-passing) fixture exists in the corpus`);
} else {
  const result = validate(honest.spans, honest.claims, optionsFor(honest));
  if (result.ok) {
    console.log(
      `  ok    the honest fixture passes with every pass enabled (rules aren't over-broad)`,
    );
  } else {
    failures++;
    console.error(
      `  FAIL  the honest fixture is rejected: ${JSON.stringify(result.violations)}`,
    );
  }
}

console.log();
if (failures > 0) {
  console.error(`verify-validator-mutations: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log(
  "verify-validator-mutations: ok -- every pass is load-bearing and none is over-broad.",
);
