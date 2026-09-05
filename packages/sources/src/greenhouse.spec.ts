import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AppError } from "@jobhunter/shared-utils";
import { describe, expect, it, vi } from "vitest";
import { createGreenhouseAdapter } from "./greenhouse.js";

const FIXTURES_DIR = fileURLToPath(new URL("../fixtures/greenhouse", import.meta.url));

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(`${FIXTURES_DIR}/${name}`, "utf8"));
}

function fetchReturning(body: unknown): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(""),
  }) as unknown as typeof fetch;
}

describe("GreenhouseAdapter", () => {
  it("discovers real recorded listings and parses them into structured jobs", async () => {
    const fetchImpl = fetchReturning(loadFixture("mixpanel-sample.json"));
    const adapter = createGreenhouseAdapter("mixpanel", { fetchImpl });

    const { listings } = await adapter.discover({});
    expect(listings).toHaveLength(3);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://boards-api.greenhouse.io/v1/boards/mixpanel/jobs?content=true",
    );

    const parsed = adapter.parse(listings[0]!);
    expect(parsed.company).toBe("Mixpanel");
    expect(parsed.title).toContain("Account Executive");
    expect(parsed.location).toBe("London, UK (Hybrid)");
    expect(parsed.url).toMatch(/^https:\/\/job-boards\.greenhouse\.io\//);
    expect(parsed.description).not.toMatch(/<[^>]*>/);
    expect(parsed.description).toContain("Mixpanel");
    expect(parsed.description.length).toBeGreaterThan(0);
    expect(parsed.postedAt).toBeInstanceOf(Date);
  });

  it("computes a stable payload hash so re-fetching an unchanged listing is detectable", async () => {
    const fixture = loadFixture("mixpanel-sample.json");
    const adapter = createGreenhouseAdapter("mixpanel", {
      fetchImpl: fetchReturning(fixture),
    });
    const first = await adapter.discover({});
    const second = await adapter.discover({});
    expect(first.listings[0]!.payloadHash).toBe(second.listings[0]!.payloadHash);
  });

  it("throws SOURCE_SCHEMA_DRIFT rather than inserting a partial row when title is missing", async () => {
    const adapter = createGreenhouseAdapter("mixpanel", {
      fetchImpl: fetchReturning(loadFixture("missing-title.json")),
    });
    const { listings } = await adapter.discover({});
    expect(() => adapter.parse(listings[0]!)).toThrowError(AppError);
    try {
      adapter.parse(listings[0]!);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("SOURCE_SCHEMA_DRIFT");
    }
  });

  it("is tolerant of a listing with no location -- location becomes null, not a thrown error", async () => {
    const fixture = {
      jobs: [{ id: 1, title: "Remote Engineer", absolute_url: "https://x/1" }],
    };
    const adapter = createGreenhouseAdapter("acme", {
      fetchImpl: fetchReturning(fixture),
    });
    const { listings } = await adapter.discover({});
    const parsed = adapter.parse(listings[0]!);
    expect(parsed.location).toBeNull();
  });

  it("declares its tier, capabilities, and rate limit", () => {
    const adapter = createGreenhouseAdapter("mixpanel");
    expect(adapter.id).toBe("greenhouse");
    expect(adapter.tier).toBe(1);
    expect(adapter.capabilities.fullDescription).toBe(true);
    expect(adapter.capabilities.requiresBrowser).toBe(false);
    expect(adapter.rateLimit.rps).toBeGreaterThan(0);
  });
});
