import { sql } from "drizzle-orm";
import type { Db } from "./client.js";

/**
 * Derived from `Db["transaction"]`'s own parameter type rather than
 * reconstructed by hand from `PgTransaction<...>`'s three generics. Manually
 * writing `PgTransaction<any, any, any>` looks equivalent but is not: a
 * conditional type distributes over a naked `any`, so `db.query`'s
 * "is the schema generic present" check collapses to a union that includes
 * its own error branch, and every `tx.query.<table>` access then fails to
 * typecheck with `DrizzleTypeError<"...schema generic is missing...">`. This
 * form always matches `Db` exactly, whatever its schema actually is.
 */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Every owner-scoped table (sql/02-rls.sql) is FORCE ROW LEVEL SECURITY,
 * gated on the `jobhunter.current_user_id` session variable. This is the
 * one place that sets it: open a transaction, set the owner id local to it
 * (so it never leaks to a different request sharing the same pooled
 * connection), then run the caller's queries inside it. A caller that
 * reaches the database any other way sees zero rows in every owner-scoped
 * table -- the fail-safe direction, not a silent leak.
 *
 * Uses `set_config(name, value, true)`, NOT `SET LOCAL name = $1`: `SET` is
 * not an ordinary statement and does not accept a bind parameter in that
 * position -- `SET LOCAL jobhunter.current_user_id = ${ownerId}` fails at
 * the server with a syntax error on every single call. `set_config()` is a
 * regular function, so it takes `ownerId` as a normal, safely-bound
 * argument. The third argument (`true`) is what makes it transaction-local,
 * equivalent to `SET LOCAL`.
 */
export async function runAsOwner<T>(
  db: Db,
  ownerId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('jobhunter.current_user_id', ${ownerId}, true)`,
    );
    return fn(tx);
  });
}
