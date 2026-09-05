import { describe, expect, it } from "vitest";
import { extractRequirements, type TaxonomyMention } from "./requirement-extraction.js";

const TAXONOMY: TaxonomyMention[] = [
  { canonicalName: "NestJS", aliases: ["nest.js", "nest"] },
  { canonicalName: "C#", aliases: ["csharp"] },
  { canonicalName: ".NET", aliases: ["dotnet"] },
  { canonicalName: "React", aliases: [] },
  { canonicalName: "Go", aliases: ["golang"] },
];

describe("extractRequirements", () => {
  it("finds a canonical name mentioned in the JD, quoting the verbatim substring", () => {
    const result = extractRequirements("We need strong NestJS experience.", TAXONOMY);
    expect(result).toEqual([{ name: "NestJS", necessity: "required", quote: "NestJS" }]);
  });

  it("matches case-insensitively but quotes the JD's actual casing", () => {
    const result = extractRequirements("Experience with nestjs required.", TAXONOMY);
    expect(result).toEqual([{ name: "NestJS", necessity: "required", quote: "nestjs" }]);
  });

  it("matches via an alias, but always names the canonical technology", () => {
    const result = extractRequirements("5+ years of C# and dotnet.", TAXONOMY);
    expect(result.map((r) => r.name).sort()).toEqual([".NET", "C#"]);
  });

  it("does not match a short substring inside an unrelated word (word-boundary safe)", () => {
    // "Go" must not match inside "Google" or "Good".
    const result = extractRequirements(
      "Experience with Google Cloud is a plus. Good communication skills.",
      TAXONOMY,
    );
    expect(result.find((r) => r.name === "Go")).toBeUndefined();
  });

  it("still matches a short technology name as its own word", () => {
    const result = extractRequirements("We use Go for backend services.", TAXONOMY);
    expect(result).toEqual([{ name: "Go", necessity: "required", quote: "Go" }]);
  });

  it("returns nothing when no taxonomy name appears in the text", () => {
    expect(
      extractRequirements(
        "A generic job description with no tech stack mentioned.",
        TAXONOMY,
      ),
    ).toEqual([]);
  });

  it("never lists the same canonical technology twice, even if both its name and an alias appear", () => {
    const result = extractRequirements(
      "NestJS (also written nest.js) experience required.",
      TAXONOMY,
    );
    expect(result.filter((r) => r.name === "NestJS")).toHaveLength(1);
  });
});
