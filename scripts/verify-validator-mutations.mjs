#!/usr/bin/env node
/**
 * Phase 2: for each rule in the validator, disable it and re-run the
 * adversarial corpus; if every fixture still fails, that rule is dead code
 * (unreachable or shadowed) and this must fail the build. Same stub
 * treatment as verify-no-fabrication.mjs until the validator exists.
 */
console.warn(
  "verify-validator-mutations: STUB -- the Phase 2 validator does not exist yet. " +
    "This is NOT a real gate.",
);
process.exit(0);
