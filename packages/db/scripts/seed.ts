/**
 * The invariant seed: the operator's user row, identity, and the taxonomy
 * graph. Idempotent -- safe to re-run. Populated in Phase 1/3; kept as a
 * clear stub until then so `pnpm db:seed` fails loudly rather than pretending
 * to do something.
 */
async function main() {
  console.log(
    "Seed is a stub -- Phase 1 (claim ledger) and Phase 3 (taxonomy) populate this.",
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
