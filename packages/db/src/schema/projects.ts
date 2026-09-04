import {
  boolean,
  date,
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./identity.js";
import { projectStatus } from "./enums.js";
import { primaryId, timestamps } from "./_shared.js";

export const projects = pgTable(
  "projects",
  {
    id: primaryId(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    slug: text().notNull(),
    description: text(),
    status: projectStatus().notNull().default("active"),
    isCurrent: boolean().notNull().default(false),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("uq_projects_owner_slug").on(t.ownerId, t.slug),
    index("idx_projects_owner").on(t.ownerId),
  ],
);

/**
 * A project can be rebuilt on a different stack without that being a
 * contradiction to resolve -- see PLAN.md's Inventra example (ASP.NET Core
 * Clean Architecture, then a full NestJS/Drizzle rewrite). Each epoch scopes
 * its own date range and stack summary, so a technology used only in an old
 * epoch surfaces with its real, dated recency instead of looking current.
 */
export const projectEpochs = pgTable(
  "project_epochs",
  {
    id: primaryId(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    label: text().notNull(),
    stackSummary: text(),
    startedOn: date({ mode: "date" }).notNull(),
    endedOn: date({ mode: "date" }),
    ...timestamps(),
  },
  (t) => [index("idx_project_epochs_project").on(t.projectId, t.startedOn.desc())],
);
