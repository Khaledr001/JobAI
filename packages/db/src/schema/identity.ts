import { pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { primaryId, timestamps } from "./_shared.js";

/**
 * Single-operator system (see docs/DECISIONS.md D-scope): no signup route,
 * no roles/permissions table. This row exists so every other table has
 * something concrete to set `owner_id` to, and so the tenancy seam (RLS
 * policies keyed on owner_id) is real rather than decorative.
 */
export const users = pgTable(
  "users",
  {
    id: primaryId(),
    email: text().notNull(),
    passwordHash: text().notNull(),
    displayName: text().notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex("uq_users_email").on(t.email)],
);
