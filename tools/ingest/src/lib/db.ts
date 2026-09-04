import { eq } from "drizzle-orm";
import { createDb, schema, type Db } from "@jobhunter/db";

/**
 * Every ingest subcommand connects as the APP role (`DATABASE_URL`), not
 * the migrator -- the whole point of building the claim ledger's
 * enforcement at the database layer (grants + `promote_claim()`, see
 * docs/DECISIONS.md D2/D4) is that even a bulk importer has to go through
 * it. There is no "trusted bulk-load" bypass.
 */
export function connect(): Db {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required (the app role, not the migrator).");
  }
  return createDb(connectionString, 1);
}

/**
 * Single-operator system (docs/DECISIONS.md scope) -- every importer acts
 * on behalf of whichever user `seed.ts` created. Throws with a clear
 * instruction rather than silently doing nothing if seeding hasn't run yet.
 */
export async function getOperatorId(db: Db): Promise<string> {
  const email = process.env.OPERATOR_EMAIL;
  if (!email) throw new Error("OPERATOR_EMAIL is required.");

  const operator = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });
  if (!operator) {
    throw new Error(
      `No user found for OPERATOR_EMAIL=${email} -- run \`pnpm db:seed\` first.`,
    );
  }
  return operator.id;
}
