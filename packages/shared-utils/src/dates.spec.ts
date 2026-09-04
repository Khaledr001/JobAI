import { describe, expect, it } from "vitest";
import { monthsBetween } from "./dates.js";

describe("monthsBetween", () => {
  it("is zero for the same date", () => {
    expect(monthsBetween(new Date("2026-01-15"), new Date("2026-01-15"))).toBe(0);
  });

  it("counts whole months", () => {
    expect(monthsBetween(new Date("2026-01-15"), new Date("2026-04-15"))).toBe(3);
  });

  it("does not round up a partial month", () => {
    expect(monthsBetween(new Date("2026-01-20"), new Date("2026-02-15"))).toBe(0);
  });

  it("is order-independent", () => {
    const a = new Date("2025-06-01");
    const b = new Date("2026-01-01");
    expect(monthsBetween(a, b)).toBe(monthsBetween(b, a));
  });

  it("crosses a year boundary", () => {
    expect(monthsBetween(new Date("2025-11-01"), new Date("2026-02-01"))).toBe(3);
  });
});
