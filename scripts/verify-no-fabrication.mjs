#!/usr/bin/env node
/**
 * The crown jewel: proves the anti-fabrication validator actually rejects
 * fabrication, against a corpus of ~20 hand-written adversarial fixtures
 * (packages/claims/fixtures/adversarial/*.json). Pure, no DB, no network --
 * this is why it can live in `pnpm verify` instead of the separate
 * `invariants` CI job that `verify-claims-integrity.mjs` needs.
 *
 * Run via `tsx` (see package.json) and imports directly from
 * packages/claims/src, NOT the compiled @jobhunter/claims package: this
 * script runs BEFORE `build` in `pnpm verify`'s pipeline (typecheck, lint,
 * test, verify:no-fabrication, verify:validator, build), so `dist/` may not
 * exist yet or may be stale. Importing source directly makes this script
 * correct regardless of build order.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAdversarialFixtures } from "../packages/claims/src/fixtures.js";
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

function optionsFor(fixture) {
  return fixture.jobDescription !== null
    ? { jobDescription: fixture.jobDescription }
    : {};
}

const fixtures = loadAdversarialFixtures(FIXTURES_DIR);
console.log(`Loaded ${fixtures.length} adversarial fixture(s) from ${FIXTURES_DIR}\n`);

let failures = 0;

for (const fixture of fixtures) {
  const result = validate(fixture.spans, fixture.claims, optionsFor(fixture));

  if (fixture.expectedCode === null) {
    if (result.ok) {
      console.log(`  ok    ${fixture.name} -- passes, as expected`);
    } else {
      failures++;
      console.error(
        `  FAIL  ${fixture.name} -- expected to pass but got: ${JSON.stringify(result.violations)}`,
      );
    }
    continue;
  }

  if (result.ok) {
    failures++;
    console.error(
      `  FAIL  ${fixture.name} -- expected ${fixture.expectedCode}, but validate() returned ok:true`,
    );
    continue;
  }

  const codes = result.violations.map((v) => v.code);
  if (codes.includes(fixture.expectedCode)) {
    console.log(`  ok    ${fixture.name} -- rejected with ${fixture.expectedCode}`);
  } else {
    failures++;
    console.error(
      `  FAIL  ${fixture.name} -- expected ${fixture.expectedCode}, got [${codes.join(", ")}]`,
    );
  }
}

console.log();
if (failures > 0) {
  console.error(
    `verify-no-fabrication: ${failures} of ${fixtures.length} fixture(s) failed.`,
  );
  process.exit(1);
}
console.log(
  `verify-no-fabrication: ok -- all ${fixtures.length} fixtures behave as expected.`,
);
