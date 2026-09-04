import { defineConfig } from "drizzle-kit";

/**
 * DATABASE_URL_MIGRATOR, never DATABASE_URL: drizzle-kit needs the
 * table-owning role to run DDL. The app role (DATABASE_URL) is intentionally
 * denied that by grants.sql once Phase 1 lands.
 */
const migratorUrl = process.env.DATABASE_URL_MIGRATOR;
if (!migratorUrl) {
  throw new Error("DATABASE_URL_MIGRATOR is required to generate or run migrations.");
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  casing: "snake_case",
  strict: true,
  dbCredentials: { url: migratorUrl },
});
