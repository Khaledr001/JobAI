import { describe, expect, it } from "vitest";
import { coverageFor } from "./coverage.js";
import type { MyTechnology, TaxonomyEdgeInput } from "./types.js";

const MY_TECHNOLOGIES: MyTechnology[] = [
  { name: "NestJS", compositeScore: 0.9, recencyScore: 0.95, verification: "documented" },
  {
    name: "PostgreSQL",
    compositeScore: 0.8,
    recencyScore: 0.9,
    verification: "documented",
  },
];

const EDGES: TaxonomyEdgeInput[] = [
  { from: "NestJS", to: "Node.js", relation: "implies", weight: 1 },
  { from: "NestJS", to: "TypeScript", relation: "implies", weight: 1 },
  { from: "PostgreSQL", to: "MongoDB", relation: "adjacent", weight: 0.25 },
];

describe("coverageFor", () => {
  it("returns the exact composite score for a direct match", () => {
    expect(coverageFor("NestJS", MY_TECHNOLOGIES, EDGES)).toEqual({
      score: 0.9,
      via: "NestJS",
    });
  });

  it("resolves a required technology via an implies edge, at full weight", () => {
    expect(coverageFor("Node.js", MY_TECHNOLOGIES, EDGES)).toEqual({
      score: 0.9,
      via: "NestJS",
    });
  });

  it("resolves a required technology via an adjacent edge, at partial weight", () => {
    expect(coverageFor("MongoDB", MY_TECHNOLOGIES, EDGES)).toEqual({
      score: 0.2,
      via: "PostgreSQL",
    });
  });

  it("returns zero score and no via when there is no exact or graph match", () => {
    expect(coverageFor("Kubernetes", MY_TECHNOLOGIES, EDGES)).toEqual({
      score: 0,
      via: null,
    });
  });

  it("prefers an exact match over any graph-expanded credit", () => {
    const myTechs: MyTechnology[] = [
      ...MY_TECHNOLOGIES,
      {
        name: "Node.js",
        compositeScore: 0.3,
        recencyScore: 0.3,
        verification: "attested",
      },
    ];
    // Node.js is both an exact (weak) match and reachable via NestJS (strong) --
    // an exact claim about the required technology itself must win regardless.
    expect(coverageFor("Node.js", myTechs, EDGES)).toEqual({
      score: 0.3,
      via: "Node.js",
    });
  });

  it("picks the highest-credit source when multiple technologies graph-expand to the same requirement", () => {
    const edges: TaxonomyEdgeInput[] = [
      { from: "Weak", to: "Target", relation: "implies", weight: 1 },
      { from: "Strong", to: "Target", relation: "implies", weight: 1 },
    ];
    const myTechs: MyTechnology[] = [
      { name: "Weak", compositeScore: 0.2, recencyScore: 0.2, verification: "attested" },
      {
        name: "Strong",
        compositeScore: 0.8,
        recencyScore: 0.8,
        verification: "documented",
      },
    ];
    expect(coverageFor("Target", myTechs, edges)).toEqual({ score: 0.8, via: "Strong" });
  });
});
