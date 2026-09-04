import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { users } from "./identity.js";
import { timestamps } from "./_shared.js";

/**
 * One row per operator (ownerId doubles as the primary key -- there is
 * exactly one profile per user, never a list). Holds the bio-level facts
 * that don't belong to a specific experience or project.
 */
export const profiles = pgTable("profiles", {
  ownerId: uuid()
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  headline: text(),
  summary: text(),
  location: text(),
  ...timestamps(),
});
