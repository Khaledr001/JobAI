import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AppError } from "@jobhunter/shared-utils";
import { describe, expect, it, vi } from "vitest";
import { createGreenhouseAdapter } from "./greenhouse.js";
import { createLeverAdapter } from "./lever.js";
import type { JobSourceAdapter } from "./types.js";

function fetchReturning(body: unknown): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(""),
  }) as unknown as typeof fetch;
}

function loadFixture(path: string): unknown {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL(`../fixtures/${path}`, import.meta.url)), "utf8"),
  );
}

/**
 * One conformance suite every adapter satisfies (PLAN.md §Verification):
 * adding an adapter costs a fixture directory, not a new test file. Every
 * entry uses a real recorded fixture, never a hand-built shape.
 */
const ADAPTERS: Array<{
  name: string;
  makeAdapter: (fetchImpl: typeof fetch) => JobSourceAdapter;
  sampleFixture: string;
  driftFixture: string;
  expectedSampleCount: number;
}> = [
  {
    name: "greenhouse",
    makeAdapter: (fetchImpl) => createGreenhouseAdapter("mixpanel", { fetchImpl }),
    sampleFixture: "greenhouse/mixpanel-sample.json",
    driftFixture: "greenhouse/missing-title.json",
    expectedSampleCount: 3,
  },
  {
    name: "lever",
    makeAdapter: (fetchImpl) => createLeverAdapter("gynger", { fetchImpl }),
    sampleFixture: "lever/gynger-sample.json",
    driftFixture: "lever/missing-text.json",
    expectedSampleCount: 3,
  },
];

describe.each(ADAPTERS)(
  "conformance: $name",
  ({ makeAdapter, sampleFixture, driftFixture, expectedSampleCount }) => {
    it("declares tier/capabilities/rateLimit and produces a canonical parse for every real recorded listing", async () => {
      const adapter = makeAdapter(fetchReturning(loadFixture(sampleFixture)));
      expect(adapter.tier).toBeGreaterThanOrEqual(1);
      expect(adapter.rateLimit.rps).toBeGreaterThan(0);

      const { listings } = await adapter.discover({});
      expect(listings.length).toBe(expectedSampleCount);
      for (const listing of listings) {
        const parsed = adapter.parse(listing);
        expect(parsed.company.length).toBeGreaterThan(0);
        expect(parsed.title.length).toBeGreaterThan(0);
        expect(parsed.url.startsWith("https://")).toBe(true);
      }
    });

    it("is idempotent: parsing the same raw listing twice yields the same structured job", async () => {
      const adapter = makeAdapter(fetchReturning(loadFixture(sampleFixture)));
      const { listings } = await adapter.discover({});
      const first = adapter.parse(listings[0]!);
      const second = adapter.parse(listings[0]!);
      expect(second).toEqual(first);
    });

    it("is loud (SOURCE_SCHEMA_DRIFT), not silent, on a listing missing a required field", async () => {
      const adapter = makeAdapter(fetchReturning(loadFixture(driftFixture)));
      const { listings } = await adapter.discover({});
      try {
        adapter.parse(listings[0]!);
        expect.unreachable("expected parse() to throw on a schema-drifted listing");
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).code).toBe("SOURCE_SCHEMA_DRIFT");
      }
    });
  },
);
