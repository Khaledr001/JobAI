import { describe, expect, it } from "vitest";
import { computeTechnologyScore, type TechUsageEntry } from "./projection.js";

const entry = (overrides: Partial<TechUsageEntry> = {}): TechUsageEntry => ({
  occurredOn: new Date("2026-06-01"),
  workEntryType: "feature",
  tagRole: "primary",
  hasSourceEvidence: true,
  projectId: "project-a",
  ...overrides,
});

describe("computeTechnologyScore", () => {
  it("throws on an empty entry list", () => {
    expect(() => computeTechnologyScore([], new Date("2026-09-01"))).toThrow();
  });

  it("caps verification at attested for learning-only usage, even with evidence", () => {
    const score = computeTechnologyScore(
      [entry({ workEntryType: "learning", hasSourceEvidence: true })],
      new Date("2026-09-01"),
    );
    expect(score.verification).toBe("attested");
  });

  it("promotes to documented once a non-learning entry carries source evidence", () => {
    const score = computeTechnologyScore(
      [entry({ workEntryType: "architecture", hasSourceEvidence: true })],
      new Date("2026-09-01"),
    );
    expect(score.verification).toBe("documented");
  });

  it("stays attested when evidence is absent, regardless of entry type", () => {
    const score = computeTechnologyScore(
      [entry({ workEntryType: "architecture", hasSourceEvidence: false })],
      new Date("2026-09-01"),
    );
    expect(score.verification).toBe("attested");
  });

  it("scores more recent usage higher than stale usage, all else equal", () => {
    const recent = computeTechnologyScore(
      [entry({ occurredOn: new Date("2026-08-01") })],
      new Date("2026-09-01"),
    );
    const stale = computeTechnologyScore(
      [entry({ occurredOn: new Date("2020-01-01") })],
      new Date("2026-09-01"),
    );
    expect(recent.recencyScore).toBeGreaterThan(stale.recencyScore);
    expect(recent.compositeScore).toBeGreaterThan(stale.compositeScore);
  });

  it("weights primary usage higher than incidental usage", () => {
    const primary = computeTechnologyScore(
      [entry({ tagRole: "primary" })],
      new Date("2026-09-01"),
    );
    const incidental = computeTechnologyScore(
      [entry({ tagRole: "incidental" })],
      new Date("2026-09-01"),
    );
    expect(primary.depthScore).toBeGreaterThan(incidental.depthScore);
  });

  it("saturates breadth at 3 distinct projects", () => {
    const threeProjects = computeTechnologyScore(
      [entry({ projectId: "a" }), entry({ projectId: "b" }), entry({ projectId: "c" })],
      new Date("2026-09-01"),
    );
    const fiveProjects = computeTechnologyScore(
      [
        entry({ projectId: "a" }),
        entry({ projectId: "b" }),
        entry({ projectId: "c" }),
        entry({ projectId: "d" }),
        entry({ projectId: "e" }),
      ],
      new Date("2026-09-01"),
    );
    expect(threeProjects.breadthScore).toBe(1);
    expect(fiveProjects.breadthScore).toBe(1);
  });

  it("computes monthsActive as the span between first and last usage", () => {
    const score = computeTechnologyScore(
      [
        entry({ occurredOn: new Date("2026-01-01") }),
        entry({ occurredOn: new Date("2026-07-01") }),
      ],
      new Date("2026-09-01"),
    );
    expect(score.monthsActive).toBe(6);
    expect(score.rawUsageCount).toBe(2);
  });

  it("counts null projectId entries without inflating projectCount", () => {
    const score = computeTechnologyScore(
      [entry({ projectId: null }), entry({ projectId: null })],
      new Date("2026-09-01"),
    );
    expect(score.projectCount).toBe(0);
  });
});
