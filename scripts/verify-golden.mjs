#!/usr/bin/env node
/**
 * Byte-compares packages/matching's 15 golden profile x job pairs against
 * their frozen expected output (PLAN.md's Phase 6 acceptance test: "verify:golden
 * byte-compares N profile x job pairs"). Pure, no DB, no network, no LLM --
 * imports @jobhunter/matching's src directly via tsx, same reasoning as
 * verify-no-fabrication.mjs (D19): correct regardless of build order.
 *
 * A mismatch here means the scoring formula changed. If that was
 * deliberate, review the diff, then regenerate with
 * `pnpm --filter @jobhunter/matching exec tsx scripts/generate-golden.mjs`
 * and commit the new golden/*.json alongside the code change that caused it
 * -- never regenerate to silence a failure you haven't looked at.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { evaluateMatch } from "../packages/matching/src/index.js";

const GOLDEN_DIR = fileURLToPath(new URL("../packages/matching/golden", import.meta.url));

const files = readdirSync(GOLDEN_DIR).filter((f) => f.endsWith(".json"));
if (files.length === 0) {
  console.error("verify-golden: no golden fixtures found in packages/matching/golden.");
  process.exit(1);
}

let failures = 0;
for (const file of files.sort()) {
  const { name, input, expected } = JSON.parse(
    readFileSync(`${GOLDEN_DIR}/${file}`, "utf8"),
  );
  const actual = evaluateMatch(input);
  const expectedJson = JSON.stringify(expected);
  const actualJson = JSON.stringify(actual);
  if (actualJson === expectedJson) {
    console.log(`  ok    ${name}`);
  } else {
    failures++;
    console.error(`  FAIL  ${name}`);
    console.error(`        expected: ${expectedJson}`);
    console.error(`        actual:   ${actualJson}`);
  }
}

console.log();
if (failures > 0) {
  console.error(`verify-golden: ${failures}/${files.length} case(s) mismatched.`);
  process.exit(1);
}
console.log(`verify-golden: ok -- all ${files.length} golden case(s) byte-match.`);
