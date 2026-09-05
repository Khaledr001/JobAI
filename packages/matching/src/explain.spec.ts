import { describe, expect, it } from "vitest";
import { evaluateMatch } from "./explain.js";
import type {
  CandidateProfile,
  JobRequirements,
  MatchInput,
  TaxonomyEdgeInput,
} from "./types.js";

const EDGES: TaxonomyEdgeInput[] = [
  { from: "NestJS", to: "Node.js", relation: "implies", weight: 1 },
  { from: "NestJS", to: "TypeScript", relation: "implies", weight: 1 },
  { from: "Next.js", to: "React", relation: "implies", weight: 1 },
  { from: "PostgreSQL", to: "MongoDB", relation: "adjacent", weight: 0.25 },
];

const CANDIDATE: CandidateProfile = {
  authorizedLocations: ["Dubai"],
  experienceYears: 3,
  domains: ["fintech"],
  technologies: [
    {
      name: "NestJS",
      compositeScore: 0.9,
      recencyScore: 0.95,
      verification: "documented",
    },
    {
      name: "PostgreSQL",
      compositeScore: 0.8,
      recencyScore: 0.85,
      verification: "documented",
    },
    { name: "Next.js", compositeScore: 0.6, recencyScore: 0.7, verification: "attested" },
  ],
};

function job(overrides: Partial<JobRequirements> = {}): JobRequirements {
  return {
    title: "Backend Engineer",
    location: "Dubai, UAE",
    remotePolicy: "onsite",
    sponsorshipAvailable: false,
    yearsRequired: null,
    domains: [],
    technologies: [
      { name: "Node.js", necessity: "required", quote: "Node.js experience" },
      { name: "PostgreSQL", necessity: "required", quote: "PostgreSQL" },
      { name: "Kubernetes", necessity: "preferred", quote: "Kubernetes a plus" },
    ],
    ...overrides,
  };
}

function input(overrides: Partial<MatchInput> = {}): MatchInput {
  return { job: job(), candidate: CANDIDATE, edges: EDGES, ...overrides };
}

describe("evaluateMatch", () => {
  it("gates a Toronto job with no sponsorship instead of scoring it -- PLAN.md's flagship gate example", () => {
    const result = evaluateMatch(
      input({
        job: job({
          location: "Toronto, ON, Canada",
          remotePolicy: "onsite",
          sponsorshipAvailable: false,
        }),
      }),
    );
    expect(result.band).toBe("gated");
    expect(result.headline).toBe(0);
    expect(result.gates.passed).toBe(false);
    expect(result.gates.failures).toContain("LOCATION_AUTHORIZATION");
  });

  it("scores a job that passes the gates", () => {
    const result = evaluateMatch(input());
    expect(result.band).not.toBe("gated");
    expect(result.gates.passed).toBe(true);
  });

  it("never emits a matched citation ('via') absent from the candidate's own technologies -- no uncited claim", () => {
    const cases: MatchInput[] = [
      input(),
      input({
        job: job({
          technologies: [{ name: "React", necessity: "required", quote: "React" }],
        }),
      }),
      input({ job: job({ technologies: [] }) }),
    ];
    for (const c of cases) {
      const result = evaluateMatch(c);
      const knownNames = new Set(c.candidate.technologies.map((t) => t.name));
      for (const m of result.matched) {
        expect(knownNames.has(m.via)).toBe(true);
      }
    }
  });

  it("is bounded to [0, 100] across a spread of inputs, including edge cases", () => {
    const cases: MatchInput[] = [
      input(),
      input({ job: job({ technologies: [] }) }),
      input({ job: job({ yearsRequired: 20 }) }),
      input({ candidate: { ...CANDIDATE, technologies: [] } }),
      input({ job: job({ domains: ["a", "b", "c", "d"] }) }),
    ];
    for (const c of cases) {
      const result = evaluateMatch(c);
      expect(result.headline).toBeGreaterThanOrEqual(0);
      expect(result.headline).toBeLessThanOrEqual(100);
    }
  });

  it("is permutation-invariant: reordering required technologies and candidate technologies changes nothing", () => {
    const base = input();
    const reordered = input({
      job: job({ technologies: [...base.job.technologies].reverse() }),
      candidate: { ...CANDIDATE, technologies: [...CANDIDATE.technologies].reverse() },
    });
    const a = evaluateMatch(base);
    const b = evaluateMatch(reordered);
    expect(b.headline).toBe(a.headline);
    expect(b.subScores).toEqual(a.subScores);
    expect(new Set(b.matched.map((m) => m.technology))).toEqual(
      new Set(a.matched.map((m) => m.technology)),
    );
    expect(new Set(b.missing.map((m) => m.technology))).toEqual(
      new Set(a.missing.map((m) => m.technology)),
    );
  });

  it("is monotone: adding a previously-missing required technology to the candidate never lowers the headline", () => {
    const before = evaluateMatch(input()); // Kubernetes is missing
    const withKubernetes = evaluateMatch(
      input({
        candidate: {
          ...CANDIDATE,
          technologies: [
            ...CANDIDATE.technologies,
            {
              name: "Kubernetes",
              compositeScore: 0.5,
              recencyScore: 0.5,
              verification: "documented",
            },
          ],
        },
      }),
    );
    expect(withKubernetes.headline).toBeGreaterThanOrEqual(before.headline);
  });

  it("is monotone: raising a matched technology's composite score never lowers the headline", () => {
    const weak = evaluateMatch(
      input({
        candidate: {
          ...CANDIDATE,
          technologies: [
            {
              name: "NestJS",
              compositeScore: 0.2,
              recencyScore: 0.2,
              verification: "attested",
            },
          ],
        },
      }),
    );
    const strong = evaluateMatch(
      input({
        candidate: {
          ...CANDIDATE,
          technologies: [
            {
              name: "NestJS",
              compositeScore: 0.95,
              recencyScore: 0.95,
              verification: "documented",
            },
          ],
        },
      }),
    );
    expect(strong.headline).toBeGreaterThanOrEqual(weak.headline);
  });

  it("carries a stable scorerVersion so match_scores can be keyed on it", () => {
    expect(evaluateMatch(input()).scorerVersion).toEqual(expect.any(String));
    expect(evaluateMatch(input()).scorerVersion.length).toBeGreaterThan(0);
  });
});
