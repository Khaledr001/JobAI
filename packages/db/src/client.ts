import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema/index.js";

/**
 * Explicit return type, not left to inference. Without it, the schema
 * generic that makes `db.query.claims` etc. resolve correctly gets erased
 * in this package's emitted .d.ts -- it typechecks fine from inside
 * packages/db itself, but every consumer (apps/api) sees
 * `DrizzleTypeError<"...schema generic is missing...">` instead of a real
 * type. This annotation is what keeps the schema generic intact across the
 * package boundary. The `$client` intersection mirrors exactly what
 * `drizzle()`'s own overload for postgres-js returns -- see its .d.ts.
 */
export function createDb(
  connectionString: string,
  poolMax = 10,
): PostgresJsDatabase<typeof schema> & { $client: Sql } {
  const client = postgres(connectionString, { max: poolMax });
  return drizzle(client, { schema, casing: "snake_case" });
}

export type Db = ReturnType<typeof createDb>;
