/**
 * Domain schema files, one per bounded concept. Order here is documentation
 * only -- Drizzle resolves cross-file references by import, not by listing
 * order -- but it's kept roughly dependency-first (identity before anything
 * that references a user, taxonomy before anything that tags a technology).
 */
export * from "./_shared.js";
export * from "./enums.js";
export * from "./identity.js";
export * from "./profile.js";
export * from "./experience.js";
export * from "./taxonomy.js";
export * from "./projects.js";
export * from "./work.js";
export * from "./claims.js";
export * from "./evidence.js";
export * from "./conflicts.js";
export * from "./profile_index.js";
export * from "./llm.js";
export * from "./relations.js";
