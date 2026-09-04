import { sql } from "drizzle-orm";
import { timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Factories, not shared column objects. A drizzle-orm column builder is
 * stateful; sharing one instance across tables makes the second table's
 * definition silently mutate the first's. Always call these, never hoist
 * their return value to a module-level const.
 */

export const primaryId = () => uuid().primaryKey().defaultRandom();

export const timestamptz = () => timestamp({ withTimezone: true, mode: "date" });

export const timestamps = () => ({
  createdAt: timestamptz()
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamptz()
    .notNull()
    .default(sql`now()`)
    .$onUpdate(() => new Date()),
});

export const createdOnly = () => ({
  createdAt: timestamptz()
    .notNull()
    .default(sql`now()`),
});
