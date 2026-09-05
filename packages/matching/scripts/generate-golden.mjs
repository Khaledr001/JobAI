#!/usr/bin/env -S npx tsx
/**
 * Run ONCE (or deliberately, after a reviewed scoring-formula change) to
 * freeze `expected` output for each case in matching-golden-cases.mjs into
 * packages/matching/golden/<name>.json. `scripts/verify-golden.mjs` (root)
 * is the permanent, CI-facing half of this pair -- it never regenerates,
 * only compares. Never run this to "fix" a failing verify:golden without
 * first understanding *why* the output changed.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { evaluateMatch } from "../src/index.js";
import { CASES } from "./matching-golden-cases.mjs";

const GOLDEN_DIR = fileURLToPath(new URL("../golden", import.meta.url));
mkdirSync(GOLDEN_DIR, { recursive: true });

for (const { name, description, input } of CASES) {
  const expected = evaluateMatch(input);
  const file = { name, description, input, expected };
  writeFileSync(`${GOLDEN_DIR}/${name}.json`, JSON.stringify(file, null, 2) + "\n");
  console.log(`wrote golden/${name}.json`);
}
console.log(`\n${CASES.length} golden case(s) written to ${GOLDEN_DIR}`);
