import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { runAsOwner, schema, type Db } from "@jobhunter/db";
import { evaluateMatch, type TaxonomyEdgeInput } from "@jobhunter/matching";
import { AppError, ERROR_CODES, monthsBetween } from "@jobhunter/shared-utils";
import { DB } from "../../database/database.module.js";
import type { JobMatchResult, RelevantProject } from "./dto.js";
import { extractRequirements } from "./requirement-extraction.js";

const MAX_RELEVANT_PROJECTS = 5;

/**
 * Wires PLAN.md's pure `@jobhunter/matching` scorer to real data -- the
 * apps/api piece Phase 6 deliberately deferred (docs/DECISIONS.md D35).
 * Two real approximations stand in for pieces not yet built, both
 * documented rather than silently assumed:
 *   - job requirements come from a deterministic keyword scan
 *     (requirement-extraction.ts), not PLAN.md's LLM-based Stage A/B parse;
 *   - `experienceYears` sums each countsTowardTotal experience's own
 *     duration, which double-counts overlapping roles -- PLAN.md's
 *     non-overlapping-months rule ("computedYears") is not implemented yet.
 */
@Injectable()
export class MatchingService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async scoreJob(ownerId: string, jobId: string): Promise<JobMatchResult> {
    const job = await this.db.query.jobCanonical.findFirst({
      where: eq(schema.jobCanonical.id, jobId),
    });
    if (!job) {
      throw new AppError(ERROR_CODES.NOT_FOUND, `Job ${jobId} not found`);
    }

    const taxonomyNodes = await this.db.query.taxonomyNodes.findMany({
      with: { aliases: true },
    });
    const requirements = extractRequirements(
      `${job.title}\n${job.description}`,
      taxonomyNodes.map((n) => ({
        canonicalName: n.canonicalName,
        aliases: n.aliases.map((a) => a.alias),
      })),
    );

    const edgeRows = await this.db.query.taxonomyEdges.findMany({
      with: { fromNode: true, toNode: true },
    });
    // Only implies/adjacent transfer credit in matching (@jobhunter/matching's
    // contract) -- broader_than/requires/used_with/belongs_to_domain describe
    // the taxonomy graph but aren't scoring-relevant here.
    const edges: TaxonomyEdgeInput[] = edgeRows
      .filter(
        (e): e is typeof e & { relation: "implies" | "adjacent" } =>
          e.relation === "implies" || e.relation === "adjacent",
      )
      .map((e) => ({
        from: e.fromNode.canonicalName,
        to: e.toNode.canonicalName,
        relation: e.relation,
        weight: Number(e.weight),
      }));

    const candidate = await runAsOwner(this.db, ownerId, async (tx) => {
      const [profile, scores, experiences] = await Promise.all([
        tx.query.profiles.findFirst({ where: eq(schema.profiles.ownerId, ownerId) }),
        tx.query.technologyScores.findMany({
          where: eq(schema.technologyScores.ownerId, ownerId),
          with: { technology: true },
        }),
        tx.query.experiences.findMany({ where: eq(schema.experiences.ownerId, ownerId) }),
      ]);

      const now = new Date();
      const experienceYears =
        experiences
          .filter((e) => e.countsTowardTotal)
          .reduce((sum, e) => sum + monthsBetween(e.startedOn, e.endedOn ?? now), 0) / 12;

      return {
        authorizedLocations: profile?.location ? [profile.location] : [],
        experienceYears,
        domains: [] as string[],
        technologies: scores.map((s) => ({
          name: s.technology.canonicalName,
          compositeScore: Number(s.compositeScore),
          recencyScore: Number(s.recencyScore),
          verification: s.verification,
        })),
      };
    });

    const match = evaluateMatch({
      job: {
        title: job.title,
        location: job.location,
        remotePolicy: null,
        // Real remote-policy/sponsorship signal only exists once Stage
        // A/B JD parsing (D35) reads it out of the raw text; until then,
        // `true` here is the honest choice -- "unknown" must never gate a
        // real job away, the same "absence of data is not a mismatch"
        // rule gates.ts already applies to a missing location.
        sponsorshipAvailable: true,
        yearsRequired: null,
        domains: [],
        technologies: requirements,
      },
      candidate,
      edges,
    });

    const nameToId = new Map(taxonomyNodes.map((n) => [n.canonicalName, n.id]));
    const matchedTechIds = match.matched
      .map((m) => nameToId.get(m.technology))
      .filter((id): id is string => id !== undefined);

    const relevantProjects = await this.rankRelevantProjects(
      ownerId,
      matchedTechIds,
      taxonomyNodes,
    );

    return { ...match, relevantProjects };
  }

  /** PLAN.md's "ranked projects each citing a work entry" -- real data, not part of @jobhunter/matching's pure contract. */
  private async rankRelevantProjects(
    ownerId: string,
    matchedTechIds: readonly string[],
    taxonomyNodes: ReadonlyArray<{ id: string; canonicalName: string }>,
  ): Promise<RelevantProject[]> {
    if (matchedTechIds.length === 0) return [];

    const idToName = new Map(taxonomyNodes.map((n) => [n.id, n.canonicalName]));

    return runAsOwner(this.db, ownerId, async (tx) => {
      const rows = await tx
        .select({
          projectId: schema.projects.id,
          projectName: schema.projects.name,
          technologyId: schema.workEntryTechnologies.technologyId,
          workEntryId: schema.workEntries.id,
          workEntryTitle: schema.workEntries.title,
          occurredOn: schema.workEntries.occurredOn,
        })
        .from(schema.workEntryTechnologies)
        .innerJoin(
          schema.workEntries,
          eq(schema.workEntryTechnologies.workEntryId, schema.workEntries.id),
        )
        .innerJoin(schema.projects, eq(schema.workEntries.projectId, schema.projects.id))
        .where(
          and(
            eq(schema.workEntries.ownerId, ownerId),
            inArray(schema.workEntryTechnologies.technologyId, matchedTechIds),
            isNull(schema.workEntries.retractedAt),
          ),
        );

      interface Group {
        projectName: string;
        technologyIds: Set<string>;
        citedWorkEntry: { id: string; title: string; occurredOn: Date };
      }
      const byProject = new Map<string, Group>();
      for (const row of rows) {
        let group = byProject.get(row.projectId);
        if (!group) {
          group = {
            projectName: row.projectName,
            technologyIds: new Set(),
            citedWorkEntry: {
              id: row.workEntryId,
              title: row.workEntryTitle,
              occurredOn: row.occurredOn,
            },
          };
          byProject.set(row.projectId, group);
        }
        group.technologyIds.add(row.technologyId);
        if (row.occurredOn > group.citedWorkEntry.occurredOn) {
          group.citedWorkEntry = {
            id: row.workEntryId,
            title: row.workEntryTitle,
            occurredOn: row.occurredOn,
          };
        }
      }

      return [...byProject.entries()]
        .map(([projectId, group]) => ({
          projectId,
          projectName: group.projectName,
          matchedTechnologies: [...group.technologyIds]
            .map((id) => idToName.get(id))
            .filter((name): name is string => name !== undefined),
          citedWorkEntry: {
            id: group.citedWorkEntry.id,
            title: group.citedWorkEntry.title,
            occurredOn: group.citedWorkEntry.occurredOn.toISOString(),
          },
        }))
        .sort((a, b) => b.matchedTechnologies.length - a.matchedTechnologies.length)
        .slice(0, MAX_RELEVANT_PROJECTS);
    });
  }
}
