import { describe, expect, it } from "vitest";
import {
  APPLICATION_TRANSITIONS,
  isLegalApplicationTransition,
} from "./application-transitions.js";
import type { ApplicationStatus } from "@jobhunter/shared-types";

describe("isLegalApplicationTransition", () => {
  it("allows every step of PLAN.md's literal chain", () => {
    const chain: ApplicationStatus[] = [
      "discovered",
      "matched",
      "drafted",
      "approved",
      "applied",
      "replied",
      "interviewing",
    ];
    for (let i = 0; i < chain.length - 1; i++) {
      expect(isLegalApplicationTransition(chain[i]!, chain[i + 1]!)).toBe(true);
    }
    expect(isLegalApplicationTransition("interviewing", "offer")).toBe(true);
  });

  it("allows rejection/ghosting from every real branch point, not just after an interview", () => {
    expect(isLegalApplicationTransition("applied", "rejected")).toBe(true);
    expect(isLegalApplicationTransition("applied", "ghosted")).toBe(true);
    expect(isLegalApplicationTransition("replied", "rejected")).toBe(true);
    expect(isLegalApplicationTransition("interviewing", "rejected")).toBe(true);
    expect(isLegalApplicationTransition("interviewing", "ghosted")).toBe(true);
  });

  it("rejects the literal illegal transition PLAN.md's acceptance test names: applied -> drafted", () => {
    expect(isLegalApplicationTransition("applied", "drafted")).toBe(false);
  });

  it("rejects skipping a state (discovered -> approved)", () => {
    expect(isLegalApplicationTransition("discovered", "approved")).toBe(false);
  });

  it("rejects any transition out of a terminal state", () => {
    expect(isLegalApplicationTransition("offer", "applied")).toBe(false);
    expect(isLegalApplicationTransition("rejected", "matched")).toBe(false);
    expect(isLegalApplicationTransition("ghosted", "discovered")).toBe(false);
  });

  it("rejects a no-op self-transition -- every status change must be a real move", () => {
    for (const status of Object.keys(APPLICATION_TRANSITIONS) as ApplicationStatus[]) {
      expect(isLegalApplicationTransition(status, status)).toBe(false);
    }
  });
});
