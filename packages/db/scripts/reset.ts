import postgres from "postgres";

/**
 * Development-only: drops and recreates the public schema, then re-runs
 * migrate + seed. Refuses to run against anything that doesn't look like a
 * local database, since this is destructive and irreversible.
 */
async function main() {
  const connectionString = process.env.DATABASE_URL_MIGRATOR;
  if (!connectionString) {
    throw new Error("DATABASE_URL_MIGRATOR is required.");
  }
  if (!/localhost|127\.0\.0\.1/.test(connectionString)) {
    throw new Error(
      "Refusing to reset a non-local database. This drops the public schema.",
    );
  }

  const client = postgres(connectionString, { max: 1 });
  console.log("Dropping and recreating public schema...");
  await client.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await client.end();
  console.log("Done. Run `pnpm db:migrate` next.");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
