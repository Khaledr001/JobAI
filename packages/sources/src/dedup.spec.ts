import { describe, expect, it } from "vitest";
import { strongDedupKey } from "./dedup.js";

describe("strongDedupKey", () => {
  it("is deterministic for identical inputs", () => {
    const a = strongDedupKey("Mixpanel", "Account Executive, DACH", "London, UK");
    const b = strongDedupKey("Mixpanel", "Account Executive, DACH", "London, UK");
    expect(a).toBe(b);
  });

  it("is case- and whitespace-insensitive", () => {
    const a = strongDedupKey("Mixpanel", "Account Executive", "London");
    const b = strongDedupKey("  MIXPANEL  ", "account   executive", "LONDON");
    expect(a).toBe(b);
  });

  it("treats a null location distinctly from an empty string, but both consistently", () => {
    const withLocation = strongDedupKey("Acme", "Engineer", "Remote");
    const withoutLocation = strongDedupKey("Acme", "Engineer", null);
    expect(withLocation).not.toBe(withoutLocation);
    expect(strongDedupKey("Acme", "Engineer", null)).toBe(withoutLocation);
  });

  it("distinguishes different companies or titles", () => {
    const a = strongDedupKey("Acme", "Engineer", "Remote");
    const b = strongDedupKey("Widgets Inc", "Engineer", "Remote");
    const c = strongDedupKey("Acme", "Senior Engineer", "Remote");
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});
