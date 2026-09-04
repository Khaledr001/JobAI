import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseWorkLog } from "./worklog.js";

const REAL_FILE = "/media/khaled/Education/Sidago/Mazarini/work-log.txt";

describe("parseWorkLog against the real work-log.txt", () => {
  const blocks = parseWorkLog(readFileSync(REAL_FILE, "utf8"));

  it("parses the dashed and non-dashed date header forms", () => {
    const dates = blocks
      .filter((b) => !b.isWeeklyReport && !b.isFuturePlan)
      .map((b) => b.date);
    expect(dates).toContain("2026-08-18");
    expect(dates).toContain("2026-08-24"); // "Work Log 24/08/2026" -- no dash
    expect(dates).toContain("2026-09-01"); // the DD/MM-ambiguous entry
  });

  it("keeps the whole sequence monotonically non-decreasing (would throw otherwise)", () => {
    const dated = blocks
      .filter((b) => !b.isFuturePlan && b.date !== "unknown")
      .map((b) => b.date);
    const sorted = [...dated].sort();
    expect(dated).toEqual(sorted);
  });

  it("attributes the weekly report to the preceding dated block", () => {
    const weekly = blocks.find((b) => b.isWeeklyReport);
    expect(weekly?.date).toBe("2026-08-21");
  });

  it("finds the Igala project inside the weekly report", () => {
    const weekly = blocks.find((b) => b.isWeeklyReport);
    expect(weekly?.entries.has("Igala")).toBe(true);
  });

  it("excludes 'Next week plan' from every dated block", () => {
    const future = blocks.find((b) => b.isFuturePlan);
    expect(future).toBeDefined();
  });

  it("groups bullets under the Mazarini project on a normal day", () => {
    const day = blocks.find((b) => b.date === "2026-08-19");
    expect(day?.entries.get("Mazarini")?.length).toBeGreaterThan(0);
  });
});

describe("parseWorkLog: monotonicity guard", () => {
  it("throws when a date goes backwards", () => {
    const text =
      "Work Log - 20/08/2026\n\nProject - X\n- did something\n\nWork Log - 19/08/2026\n\nProject - X\n- did something else\n";
    expect(() => parseWorkLog(text)).toThrow(/date .* appears after/);
  });
});
