/**
 * Operator CLI -- one subcommand per source, plus `conflicts` and `report`.
 * See PLAN.md §Seeding for the exact command list and import order (manifests
 * before the git scan; resume.md's skills table before anything that depends
 * on the taxonomy existing). Every subcommand supports --dry-run.
 *
 * A stub until Phase 3: real ingestion needs the Phase 1 claim-ledger schema
 * to write into.
 */
const [, , command] = process.argv;

const KNOWN_COMMANDS = [
  "resume",
  "portfolio",
  "work-log",
  "doc",
  "git",
  "manifests",
  "conflicts",
  "report",
  "all",
] as const;

function main() {
  if (!command || !KNOWN_COMMANDS.includes(command as (typeof KNOWN_COMMANDS)[number])) {
    console.error(
      `Usage: pnpm ingest <${KNOWN_COMMANDS.join("|")}> [--file <path>] [--dry-run]`,
    );
    process.exit(1);
  }
  console.log(
    `ingest ${command}: not yet implemented (Phase 3, needs the Phase 1 schema).`,
  );
}

main();
