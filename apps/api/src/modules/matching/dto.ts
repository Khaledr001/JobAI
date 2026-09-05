import type { MatchExplanation } from "@jobhunter/matching";

export interface RelevantProject {
  projectId: string;
  projectName: string;
  matchedTechnologies: string[];
  citedWorkEntry: { id: string; title: string; occurredOn: string };
}

/**
 * PLAN.md's "ranked projects each citing a work entry" -- an apps/api-only
 * enrichment on top of the pure `MatchExplanation`, since it reads real
 * `work_entries`/`projects` data that @jobhunter/matching never touches.
 */
export interface JobMatchResult extends MatchExplanation {
  relevantProjects: RelevantProject[];
}
