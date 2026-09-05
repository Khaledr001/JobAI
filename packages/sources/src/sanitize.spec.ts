import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "./sanitize.js";

describe("sanitizeHtml", () => {
  it("decodes Greenhouse's double-escaped HTML and strips tags", () => {
    const input =
      "&lt;div class=&quot;content-intro&quot;&gt;&lt;p&gt;&lt;strong&gt;About&lt;/strong&gt;&lt;/p&gt;&lt;/div&gt;";
    expect(sanitizeHtml(input)).toBe("About");
  });

  it("collapses whitespace and trims", () => {
    expect(sanitizeHtml("  <p>Hello</p>\n\n  <p>World</p>  ")).toBe("Hello World");
  });

  it("decodes real HTML entities within text, not just tag delimiters", () => {
    expect(sanitizeHtml("<p>Sales &amp; Marketing</p>")).toBe("Sales & Marketing");
  });

  it("is idempotent -- sanitizing already-plain text changes nothing but whitespace", () => {
    const plain = "Already plain text with no markup.";
    expect(sanitizeHtml(plain)).toBe(plain);
    expect(sanitizeHtml(sanitizeHtml(plain))).toBe(sanitizeHtml(plain));
  });

  it("terminates and decodes fully on input with many repeated entities", () => {
    const input = "&amp;".repeat(20);
    expect(sanitizeHtml(input)).toBe("&".repeat(20));
  });

  it("sanitizes a real recorded Greenhouse description to stable plain text", () => {
    const raw =
      "&lt;div class=&quot;content-intro&quot;&gt;&lt;p&gt;&lt;strong&gt;About Mixpanel&lt;/strong&gt;&lt;/p&gt;\n&lt;p&gt;Mixpanel is the leading product intelligence platform.&lt;/p&gt;&lt;/div&gt;";
    expect(sanitizeHtml(raw)).toBe(
      "About Mixpanel Mixpanel is the leading product intelligence platform.",
    );
  });
});
