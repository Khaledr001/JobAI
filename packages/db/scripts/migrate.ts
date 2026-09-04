import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

async function main() {
  const connectionString = process.env.DATABASE_URL_MIGRATOR;
  if (!connectionString) {
    throw new Error("DATABASE_URL_MIGRATOR is required to run migrations.");
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  console.log("Running drizzle migrations...");
  await migrate(db, { migrationsFolder: join(root, "migrations") });

  // Re-apply hand-written SQL (triggers, views, grants, and later partitions)
  // after every migration -- idempotent by construction, same pattern as the
  // reference repo's RLS re-application. Files run in filename order, so
  // number-prefix them (01-, 02-, ...) when ordering matters.
  const sqlDir = join(root, "sql");
  let sqlFiles: string[] = [];
  try {
    sqlFiles = readdirSync(sqlDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
  } catch {
    // sql/ doesn't exist yet -- fine before Phase 1 lands.
  }

  for (const file of sqlFiles) {
    console.log(`Applying ${file}...`);
    const contents = readFileSync(join(sqlDir, file), "utf8");
    await client.unsafe(contents);
  }

  await client.end();
  console.log("Migrations complete.");
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
