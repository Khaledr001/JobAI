import { relations } from "drizzle-orm";
import { claims } from "./claims.js";
import { evidence } from "./evidence.js";
import { conflictClaims, conflictPositions, conflicts } from "./conflicts.js";
import { technologyScores } from "./profile_index.js";
import { projectEpochs, projects } from "./projects.js";
import { taxonomyAliases, taxonomyEdges, taxonomyNodes } from "./taxonomy.js";
import { workEntries, workEntryTechnologies } from "./work.js";

/**
 * Drizzle's relational query API (`db.query.x.findMany({ with: {...} })`)
 * needs these declared explicitly -- they don't fall out of the foreign key
 * columns automatically. Kept in one file, separate from the table
 * definitions themselves, so a schema file never needs to import a table
 * that references it back (projects.ts has no reason to know about
 * project_epochs.ts otherwise).
 */

export const projectsRelations = relations(projects, ({ many }) => ({
  epochs: many(projectEpochs),
  workEntries: many(workEntries),
}));

export const projectEpochsRelations = relations(projectEpochs, ({ one }) => ({
  project: one(projects, {
    fields: [projectEpochs.projectId],
    references: [projects.id],
  }),
}));

export const workEntriesRelations = relations(workEntries, ({ one, many }) => ({
  project: one(projects, { fields: [workEntries.projectId], references: [projects.id] }),
  epoch: one(projectEpochs, {
    fields: [workEntries.epochId],
    references: [projectEpochs.id],
  }),
  technologies: many(workEntryTechnologies),
}));

export const workEntryTechnologiesRelations = relations(
  workEntryTechnologies,
  ({ one }) => ({
    workEntry: one(workEntries, {
      fields: [workEntryTechnologies.workEntryId],
      references: [workEntries.id],
    }),
    technology: one(taxonomyNodes, {
      fields: [workEntryTechnologies.technologyId],
      references: [taxonomyNodes.id],
    }),
  }),
);

export const taxonomyNodesRelations = relations(taxonomyNodes, ({ many }) => ({
  aliases: many(taxonomyAliases),
  outgoingEdges: many(taxonomyEdges, { relationName: "fromNode" }),
  incomingEdges: many(taxonomyEdges, { relationName: "toNode" }),
}));

export const taxonomyAliasesRelations = relations(taxonomyAliases, ({ one }) => ({
  node: one(taxonomyNodes, {
    fields: [taxonomyAliases.nodeId],
    references: [taxonomyNodes.id],
  }),
}));

export const taxonomyEdgesRelations = relations(taxonomyEdges, ({ one }) => ({
  fromNode: one(taxonomyNodes, {
    fields: [taxonomyEdges.fromNodeId],
    references: [taxonomyNodes.id],
    relationName: "fromNode",
  }),
  toNode: one(taxonomyNodes, {
    fields: [taxonomyEdges.toNodeId],
    references: [taxonomyNodes.id],
    relationName: "toNode",
  }),
}));

export const technologyScoresRelations = relations(technologyScores, ({ one }) => ({
  technology: one(taxonomyNodes, {
    fields: [technologyScores.technologyId],
    references: [taxonomyNodes.id],
  }),
}));

export const claimsRelations = relations(claims, ({ many }) => ({
  evidence: many(evidence),
}));

export const evidenceRelations = relations(evidence, ({ one }) => ({
  claim: one(claims, { fields: [evidence.claimId], references: [claims.id] }),
}));

export const conflictsRelations = relations(conflicts, ({ many }) => ({
  positions: many(conflictPositions),
  claims: many(conflictClaims),
}));

export const conflictPositionsRelations = relations(conflictPositions, ({ one }) => ({
  conflict: one(conflicts, {
    fields: [conflictPositions.conflictId],
    references: [conflicts.id],
  }),
  evidence: one(evidence, {
    fields: [conflictPositions.evidenceId],
    references: [evidence.id],
  }),
}));

export const conflictClaimsRelations = relations(conflictClaims, ({ one }) => ({
  conflict: one(conflicts, {
    fields: [conflictClaims.conflictId],
    references: [conflicts.id],
  }),
  claim: one(claims, { fields: [conflictClaims.claimId], references: [claims.id] }),
}));
