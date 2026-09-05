import { describe, expect, it } from "vitest";
import { evaluateGates } from "./gates.js";
import type { CandidateProfile, JobRequirements } from "./types.js";

const CANDIDATE: CandidateProfile = {
  authorizedLocations: ["Dubai", "United Arab Emirates"],
  experienceYears: 3,
  domains: [],
  technologies: [],
};

function job(overrides: Partial<JobRequirements> = {}): JobRequirements {
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

describe("evaluateGates", () => {
  it("gates a Toronto job with no sponsorship for a candidate authorized only in the UAE", () => {
    const result = evaluateGates(
      job({
        location: "Toronto, ON, Canada",
        remotePolicy: "onsite",
        sponsorshipAvailable: false,
      }),
      CANDIDATE,
    );
    expect(result.passed).toBe(false);
    expect(result.failures).toContain("LOCATION_AUTHORIZATION");
  });

  it("passes a remote job regardless of location or sponsorship", () => {
    const result = evaluateGates(
      job({
        location: "Toronto, ON, Canada",
        remotePolicy: "remote",
        sponsorshipAvailable: false,
      }),
      CANDIDATE,
    );
    expect(result.passed).toBe(true);
  });

  it("passes an onsite job in the candidate's own authorized location", () => {
    const result = evaluateGates(
      job({ location: "Dubai, UAE", remotePolicy: "onsite" }),
      CANDIDATE,
    );
    expect(result.passed).toBe(true);
  });

  it("passes an onsite job elsewhere when the employer explicitly offers sponsorship", () => {
    const result = evaluateGates(
      job({
        location: "Toronto, ON, Canada",
        remotePolicy: "onsite",
        sponsorshipAvailable: true,
      }),
      CANDIDATE,
    );
    expect(result.passed).toBe(true);
  });

  it("does not gate on a job with no stated location -- absence of data is not evidence of a mismatch", () => {
    const result = evaluateGates(
      job({ location: null, remotePolicy: "onsite" }),
      CANDIDATE,
    );
    expect(result.passed).toBe(true);
  });

  it("gates on a hard-excluded required technology", () => {
    const result = evaluateGates(
      job({
        location: "Dubai, UAE",
        technologies: [{ name: "PHP", necessity: "required", quote: "5+ years of PHP" }],
      }),
      { ...CANDIDATE, excludedTechnologies: ["PHP"] },
    );
    expect(result.passed).toBe(false);
    expect(result.failures).toContain("EXCLUDED_STACK");
  });

  it("does not gate on an excluded technology that is only preferred, not required", () => {
    const result = evaluateGates(
      job({
        location: "Dubai, UAE",
        technologies: [{ name: "PHP", necessity: "preferred", quote: "PHP a plus" }],
      }),
      { ...CANDIDATE, excludedTechnologies: ["PHP"] },
    );
    expect(result.passed).toBe(true);
  });
});
