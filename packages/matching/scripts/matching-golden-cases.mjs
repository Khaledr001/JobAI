/**
 * The 15 named profile x job pairs behind `verify:golden`. Deliberately
 * grounded in this operator's real seeded taxonomy (packages/db/scripts/seed.ts's
 * 23 real edges), not arbitrary strings -- a golden corpus over fictional
 * technology names would never catch a real graph-expansion regression.
 *
 * Each case is a complete, self-contained MatchInput. Shared with both
 * generate-golden.mjs (writes the frozen `expected` once) and
 * scripts/verify-golden.mjs (re-runs evaluateMatch and byte-compares).
 */

const EDGES = [
  { from: "NestJS", to: "Node.js", relation: "implies", weight: 1 },
  { from: "NestJS", to: "TypeScript", relation: "implies", weight: 1 },
  { from: "Angular", to: "TypeScript", relation: "implies", weight: 1 },
  { from: "Next.js", to: "React", relation: "implies", weight: 1 },
  { from: "EF Core", to: "C#", relation: "implies", weight: 1 },
  { from: "EF Core", to: ".NET", relation: "implies", weight: 1 },
  { from: "C#", to: ".NET", relation: "implies", weight: 1 },
  { from: "Drizzle", to: "PostgreSQL", relation: "implies", weight: 1 },
  { from: "Drizzle", to: "EF Core", relation: "adjacent", weight: 0.4 },
  { from: "EF Core", to: "Drizzle", relation: "adjacent", weight: 0.4 },
  { from: "PostgreSQL", to: "MongoDB", relation: "adjacent", weight: 0.25 },
  { from: "MongoDB", to: "PostgreSQL", relation: "adjacent", weight: 0.25 },
  { from: "NATS", to: "RabbitMQ", relation: "adjacent", weight: 0.7 },
  { from: "RabbitMQ", to: "NATS", relation: "adjacent", weight: 0.7 },
  { from: "Angular", to: "React", relation: "adjacent", weight: 0.5 },
  { from: "React", to: "Angular", relation: "adjacent", weight: 0.5 },
];

const CANDIDATE = {
  authorizedLocations: ["Dubai", "United Arab Emirates"],
  experienceYears: 3,
  domains: ["fintech", "e-commerce"],
  technologies: [
    {
      name: "NestJS",
      compositeScore: 0.92,
      recencyScore: 0.95,
      verification: "documented",
    },
    {
      name: "TypeScript",
      compositeScore: 0.9,
      recencyScore: 0.93,
      verification: "documented",
    },
    {
      name: "PostgreSQL",
      compositeScore: 0.85,
      recencyScore: 0.88,
      verification: "documented",
    },
    {
      name: "Drizzle",
      compositeScore: 0.7,
      recencyScore: 0.8,
      verification: "documented",
    },
    { name: "React", compositeScore: 0.55, recencyScore: 0.6, verification: "attested" },
  ],
};

function job(overrides = {}) {
  return {
    title: "Backend Engineer",
    location: "Dubai, UAE",
    remotePolicy: "onsite",
    sponsorshipAvailable: false,
    yearsRequired: null,
    domains: [],
    technologies: [],
    ...overrides,
  };
}

export const CASES = [
  {
    name: "exact-match-strong",
    description:
      "Every required technology is an exact, well-scored match; strong band expected.",
    input: {
      job: job({
        technologies: [
          { name: "NestJS", necessity: "required", quote: "NestJS" },
          { name: "TypeScript", necessity: "required", quote: "TypeScript" },
          { name: "PostgreSQL", necessity: "required", quote: "PostgreSQL" },
        ],
      }),
      candidate: CANDIDATE,
      edges: EDGES,
    },
  },
  {
    name: "graph-expanded-implies-match",
    description:
      "The JD asks for Node.js, which the candidate covers only via NestJS's implies edge.",
    input: {
      job: job({
        technologies: [
          { name: "Node.js", necessity: "required", quote: "Node.js experience" },
        ],
      }),
      candidate: CANDIDATE,
      edges: EDGES,
    },
  },
  {
    name: "adjacent-partial-credit-match",
    description:
      "The JD asks for MongoDB; the candidate's PostgreSQL only covers it partially via an adjacent edge.",
    input: {
      job: job({
        technologies: [{ name: "MongoDB", necessity: "required", quote: "MongoDB" }],
      }),
      candidate: CANDIDATE,
      edges: EDGES,
    },
  },
  {
    name: "missing-required-technology",
    description:
      "Kubernetes is required and has no exact or graph match anywhere in the candidate's stack.",
    input: {
      job: job({
        technologies: [
          { name: "Kubernetes", necessity: "required", quote: "Kubernetes required" },
        ],
      }),
      candidate: CANDIDATE,
      edges: EDGES,
    },
  },
  {
    name: "missing-preferred-technology-only",
    description:
      "The one required technology matches; a preferred technology is missing but weighs less.",
    input: {
      job: job({
        technologies: [
          { name: "NestJS", necessity: "required", quote: "NestJS" },
          { name: "Kubernetes", necessity: "preferred", quote: "Kubernetes a plus" },
        ],
      }),
      candidate: CANDIDATE,
      edges: EDGES,
    },
  },
  {
    name: "gated-toronto-no-sponsorship",
    description:
      "PLAN.md's flagship gate example: onsite Toronto role, no sponsorship, candidate authorized only in the UAE.",
    input: {
      job: job({
        location: "Toronto, ON, Canada",
        remotePolicy: "onsite",
        sponsorshipAvailable: false,
      }),
      candidate: CANDIDATE,
      edges: EDGES,
    },
  },
  {
    name: "gated-excluded-required-stack",
    description:
      "The JD requires a technology the candidate has pre-decided to exclude entirely.",
    input: {
      job: job({
        technologies: [{ name: "PHP", necessity: "required", quote: "5+ years PHP" }],
      }),
      candidate: { ...CANDIDATE, excludedTechnologies: ["PHP"] },
      edges: EDGES,
    },
  },
  {
    name: "remote-job-bypasses-location-gate",
    description:
      "A fully remote job never gates on location or sponsorship, regardless of where it's based.",
    input: {
      job: job({
        location: "Toronto, ON, Canada",
        remotePolicy: "remote",
        sponsorshipAvailable: false,
      }),
      candidate: CANDIDATE,
      edges: EDGES,
    },
  },
  {
    name: "sponsorship-offered-passes-gate",
    description:
      "An onsite job outside the candidate's authorized locations still passes when sponsorship is explicitly offered.",
    input: {
      job: job({
        location: "Toronto, ON, Canada",
        remotePolicy: "onsite",
        sponsorshipAvailable: true,
      }),
      candidate: CANDIDATE,
      edges: EDGES,
    },
  },
  {
    name: "seniority-shortfall",
    description:
      "The role wants 6 years; the candidate has 3 -- a real, partial seniority-fit penalty.",
    input: {
      job: job({ yearsRequired: 6 }),
      candidate: CANDIDATE,
      edges: EDGES,
    },
  },
  {
    name: "seniority-overqualified-no-penalty",
    description:
      "The role wants 1 year; the candidate has 3 -- full seniority credit, no overqualification cliff.",
    input: {
      job: job({ yearsRequired: 1 }),
      candidate: CANDIDATE,
      edges: EDGES,
    },
  },
  {
    name: "domain-mismatch",
    description:
      "The JD wants healthcare domain experience; the candidate's domains are fintech/e-commerce only.",
    input: {
      job: job({ domains: ["healthcare"] }),
      candidate: CANDIDATE,
      edges: EDGES,
    },
  },
  {
    name: "domain-full-overlap",
    description: "The JD wants fintech domain experience, which the candidate has.",
    input: {
      job: job({ domains: ["fintech"] }),
      candidate: CANDIDATE,
      edges: EDGES,
    },
  },
  {
    name: "no-stack-requirements-stated",
    description:
      "The JD lists no required or preferred technologies at all -- stack/recency default to full credit.",
    input: {
      job: job({ technologies: [] }),
      candidate: CANDIDATE,
      edges: EDGES,
    },
  },
  {
    name: "candidate-with-no-technologies-yet",
    description:
      "A brand-new operator profile with zero confirmed technology claims -- every requirement is MISSING, but nothing is gated.",
    input: {
      job: job({
        technologies: [
          { name: "NestJS", necessity: "required", quote: "NestJS" },
          { name: "PostgreSQL", necessity: "required", quote: "PostgreSQL" },
        ],
      }),
      candidate: { ...CANDIDATE, technologies: [] },
      edges: EDGES,
    },
  },
];
