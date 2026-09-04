import {
  boolean,
  index,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./identity.js";
import { claims } from "./claims.js";
import { evidence } from "./evidence.js";
import { conflictKind, conflictStatus } from "./enums.js";
import { primaryId, timestamps, timestamptz } from "./_shared.js";

/**
 * Surfaced, never auto-resolved -- see PLAN.md's four contradictory
 * Bizreflex end-dates and the 30%-vs-40% latency claim. `blocksEmission`
 * defaults true: an open conflict over a claim removes it from
 * `v_emittable_claims` until a human resolves it, which is the mechanism
 * `docs/DECISIONS.md` D1/D2 actually rely on.
 */
export const conflicts = pgTable(
  "conflicts",
  {
    id: primaryId(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: conflictKind().notNull(),
    /** One line for the review UI, e.g. "Bizreflex end date". */
    subject: text().notNull(),
    status: conflictStatus().notNull().default("open"),
    blocksEmission: boolean().notNull().default(true),
    resolutionNote: text(),
    resolvedAt: timestamptz(),
    resolvedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [index("idx_conflicts_owner_status").on(t.ownerId, t.status)],
);

/**
 * One row per competing value a conflict is choosing between. `strength`
 * (trust x freshness) only orders the review UI -- it never auto-resolves
 * anything, which is the entire point of surfacing the conflict at all.
 */
export const conflictPositions = pgTable(
  "conflict_positions",
  {
    id: primaryId(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conflictId: uuid()
      .notNull()
      .references(() => conflicts.id, { onDelete: "cascade" }),
    /** Normalized for comparison, e.g. {"endedOn":"2026-01-31"} or {"value":30,"unit":"percent"}. */
    value: jsonb().$type<Record<string, unknown>>().notNull(),
    /** Human-readable, e.g. "Jan 2026" or "~30%". */
    display: text().notNull(),
    evidenceId: uuid().references(() => evidence.id, { onDelete: "set null" }),
    strength: numeric({ precision: 4, scale: 3 }).notNull().default("0.500"),
    ...timestamps(),
  },
  (t) => [index("idx_conflict_positions_conflict").on(t.conflictId, t.strength)],
);

/** Normalized join, not a jsonb array on `conflicts` -- `v_emittable_claims` reads this on every row. */
export const conflictClaims = pgTable(
  "conflict_claims",
  {
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conflictId: uuid()
      .notNull()
      .references(() => conflicts.id, { onDelete: "cascade" }),
    claimId: uuid()
      .notNull()
      .references(() => claims.id, { onDelete: "cascade" }),
    ...timestamps(),
  },
  (t) => [
    primaryKey({ columns: [t.conflictId, t.claimId] }),
    index("idx_conflict_claims_claim").on(t.claimId),
  ],
);
