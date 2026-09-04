import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseProjectDocumentation } from "./doc.js";

describe("parseProjectDocumentation against the real, conflicting doc copies", () => {
  it("extracts 27 content types from the older (Sidago/) copy", () => {
    const text = readFileSync(
      "/media/khaled/Education/Sidago/PROJECT_DOCUMENTATION.md",
      "utf8",
    );
    const doc = parseProjectDocumentation(text);
    expect(doc.preparedDate).toBe("2026-04-30");
    expect(doc.moduleCount).toEqual({ count: 27, unit: "content_types" });
  });

  it("extracts 32 content types from the newer (Sidago/Mazarini/) copy -- a different number for the same past milestone", () => {
    const text = readFileSync(
      "/media/khaled/Education/Sidago/Mazarini/PROJECT_DOCUMENTATION.md",
      "utf8",
    );
    const doc = parseProjectDocumentation(text);
    expect(doc.preparedDate).toBe("2026-05-04");
    expect(doc.moduleCount).toEqual({ count: 32, unit: "content_types" });
  });

  it("does not crash on the older doc's malformed multi-line phase row, and still extracts the well-formed rows", () => {
    const text = readFileSync(
      "/media/khaled/Education/Sidago/PROJECT_DOCUMENTATION.md",
      "utf8",
    );
    const doc = parseProjectDocumentation(text);
    expect(doc.completedPhases.length).toBeGreaterThan(0);
    expect(doc.completedPhases.some((p) => p.name.includes("Project Setup"))).toBe(true);
  });
});
