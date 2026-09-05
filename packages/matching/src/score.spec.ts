import { describe, expect, it } from "vitest";
import { scoreDeterministic } from "./score.js";
import type { CandidateProfile, JobRequirements, TaxonomyEdgeInput } from "./types.js";

function job(overrides: Partial<JobRequirements> = {}): JobRequirements {
  return {
    title: "Backend Engineer",
    location: null,
    remotePolicy: "remote",
    sponsorshipAvailable: true,
    yearsRequired: null,
    domains: [],
    technologies: [],
    ...overrides,
  };
}

function candidate(overrides: Partial<CandidateProfile> = {}): CandidateProfile {
  return {
    authorizedLocations: [],
    experienceYears: 3,
    domains: [],
    technologies: [],
    ...overrides,
  };
}

describe("scoreDeterministic", () => {
  it("gives full stack/recency credit with no required technologies at all", () => {
    const result = scoreDeterministic(job(), candidate(), []);
    expect(result.subScores.stackFit).toBe(1);
    expect(result.subScores.recencyFit).toBe(1);
    expect(result.matched).toEqual([]);
    expect(result.missing).toEqual([]);
  });

  it("weights a required technology more than a preferred one", () => {
    const edges: TaxonomyEdgeInput[] = [];
    const myTechs = candidate({
      technologies: [
        {
          name: "NestJS",
          compositeScore: 1,
          recencyScore: 1,
          verification: "documented",
        },
      ],
    });
    const requiredOnly = scoreDeterministic(
      job({
        technologies: [
          { name: "NestJS", necessity: "required", quote: "NestJS" },
          { name: "Kubernetes", necessity: "required", quote: "Kubernetes" },
        ],
      }),
      myTechs,
      edges,
    );
    const preferredMissing = scoreDeterministic(
      job({
        technologies: [
          { name: "NestJS", necessity: "required", quote: "NestJS" },
          { name: "Kubernetes", necessity: "preferred", quote: "Kubernetes a plus" },
        ],
      }),
      myTechs,
      edges,
    );
    // Missing the SAME technology hurts less when it's only preferred.
    expect(preferredMissing.subScores.stackFit).toBeGreaterThan(
      requiredOnly.subScores.stackFit,
    );
  });

  it("lists an unmatched required technology as MISSING with status set", () => {
    const result = scoreDeterministic(
      job({
        technologies: [
          { name: "Kubernetes", necessity: "required", quote: "Kubernetes" },
        ],
      }),
      candidate(),
      [],
    );
    expect(result.missing).toEqual([
      {
        technology: "Kubernetes",
        necessity: "required",
        quote: "Kubernetes",
        status: "MISSING",
      },
    ]);
    expect(result.matched).toEqual([]);
  });

  it("gives full seniority credit when experience meets or exceeds the requirement", () => {
    const atRequirement = scoreDeterministic(
      job({ yearsRequired: 3 }),
      candidate({ experienceYears: 3 }),
      [],
    );
    const overqualified = scoreDeterministic(
      job({ yearsRequired: 3 }),
      candidate({ experienceYears: 8 }),
      [],
    );
    expect(atRequirement.subScores.seniorityFit).toBe(1);
    expect(overqualified.subScores.seniorityFit).toBe(1);
  });

  it("falls off linearly, floored at 0, when under the seniority requirement", () => {
    const oneYearShort = scoreDeterministic(
      job({ yearsRequired: 4 }),
      candidate({ experienceYears: 3 }),
      [],
    );
    const threeYearsShort = scoreDeterministic(
      job({ yearsRequired: 6 }),
      candidate({ experienceYears: 3 }),
      [],
    );
    const wayShort = scoreDeterministic(
      job({ yearsRequired: 10 }),
      candidate({ experienceYears: 3 }),
      [],
    );
    expect(oneYearShort.subScores.seniorityFit).toBeCloseTo(1 - 1 / 3, 5);
    expect(threeYearsShort.subScores.seniorityFit).toBe(0);
    expect(wayShort.subScores.seniorityFit).toBe(0);
  });

  it("gives full domain credit when the job states no domain requirement", () => {
    const result = scoreDeterministic(
      job({ domains: [] }),
      candidate({ domains: ["fintech"] }),
      [],
    );
    expect(result.subScores.domainOverlap).toBe(1);
  });

  it("computes partial domain overlap case-insensitively", () => {
    const result = scoreDeterministic(
      job({ domains: ["FinTech", "Healthcare"] }),
      candidate({ domains: ["fintech"] }),
      [],
    );
    expect(result.subScores.domainOverlap).toBe(0.5);
  });
});
