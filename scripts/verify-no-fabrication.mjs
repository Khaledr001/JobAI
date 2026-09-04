#!/usr/bin/env node
/**
 * Phase 2 fills packages/claims/fixtures/adversarial/ with ~20 recorded
 * generator outputs, each asserting a specific violation code from the
 * validator in packages/claims/src/validator.ts. See docs/VERIFICATION.md
 * and PLAN.md's fixture table.
 *
 * Until those fixtures exist, this exits 0 with a loud notice rather than
 * silently reporting success -- an empty pass here must never be mistaken
 * for "fabrication is prevented".
 */
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const FIXTURES_DIR = resolve(
  import.meta.dirname,
  "..",
  "packages/claims/fixtures/adversarial",
);

let fixtureFiles = [];
try {
  fixtureFiles = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".json"));
} catch {
  // directory doesn't exist yet -- fine before Phase 2
}

if (fixtureFiles.length === 0) {
  console.warn(
    "verify-no-fabrication: STUB -- no adversarial fixtures yet (Phase 2). " +
      "This is NOT a real gate until packages/claims/fixtures/adversarial/*.json exist.",
  );
  process.exit(0);
}

console.error(
  `verify-no-fabrication: found ${fixtureFiles.length} fixture(s) but the runner is not yet ` +
    "implemented -- update this script alongside the Phase 2 validator.",
);
process.exit(1);
