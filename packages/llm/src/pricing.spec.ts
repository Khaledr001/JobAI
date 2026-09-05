import { describe, expect, it } from "vitest";
import { estimateCostUsd, isPeakUtc } from "./pricing.js";

describe("isPeakUtc", () => {
  it("is peak on a weekday morning UTC window", () => {
    expect(isPeakUtc(new Date("2026-09-09T02:00:00Z"))).toBe(true); // Wednesday
    expect(isPeakUtc(new Date("2026-09-09T08:00:00Z"))).toBe(true);
  });

  it("is off-peak outside the windows on a weekday", () => {
    expect(isPeakUtc(new Date("2026-09-09T05:00:00Z"))).toBe(false);
    expect(isPeakUtc(new Date("2026-09-09T12:00:00Z"))).toBe(false);
  });

  it("is always off-peak on a weekend, even inside the hour window", () => {
    expect(isPeakUtc(new Date("2026-09-12T02:00:00Z"))).toBe(false); // Saturday
    expect(isPeakUtc(new Date("2026-09-13T08:00:00Z"))).toBe(false); // Sunday
  });

  it("flags 07:00 Dubai time as peak -- the exact mistake PLAN.md's original 07:00 batch made", () => {
    // 07:00 Asia/Dubai (UTC+4) = 03:00 UTC, inside the 01:00-04:00 peak window.
    expect(isPeakUtc(new Date("2026-09-09T03:00:00Z"))).toBe(true);
  });
});

describe("estimateCostUsd", () => {
  const usage = { cacheHitTokens: 1_000_000, cacheMissTokens: 0, completionTokens: 0 };

  it("charges exactly double for the same usage at peak vs off-peak", () => {
    const offPeak = estimateCostUsd(
      "deepseek-v4-flash",
      usage,
      new Date("2026-09-09T12:00:00Z"),
    );
    const peak = estimateCostUsd(
      "deepseek-v4-flash",
      usage,
      new Date("2026-09-09T02:00:00Z"),
    );
    expect(peak).toBeCloseTo(offPeak * 2, 10);
  });

  it("cache-hit tokens are far cheaper than cache-miss tokens for the same model and time", () => {
    const at = new Date("2026-09-09T12:00:00Z");
    const hitCost = estimateCostUsd(
      "deepseek-v4-flash",
      { cacheHitTokens: 1_000_000, cacheMissTokens: 0, completionTokens: 0 },
      at,
    );
    const missCost = estimateCostUsd(
      "deepseek-v4-flash",
      { cacheHitTokens: 0, cacheMissTokens: 1_000_000, completionTokens: 0 },
      at,
    );
    expect(missCost / hitCost).toBeGreaterThan(20); // PLAN.md: "~31x cheaper"
  });

  it("deepseek-v4-pro costs more than deepseek-v4-flash for identical usage", () => {
    const at = new Date("2026-09-09T12:00:00Z");
    const flash = estimateCostUsd("deepseek-v4-flash", usage, at);
    const pro = estimateCostUsd("deepseek-v4-pro", usage, at);
    expect(pro).toBeGreaterThan(flash);
  });
});
