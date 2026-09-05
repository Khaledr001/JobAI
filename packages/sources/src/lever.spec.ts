import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AppError } from "@jobhunter/shared-utils";
import { describe, expect, it, vi } from "vitest";
import { createLeverAdapter } from "./lever.js";

const FIXTURES_DIR = fileURLToPath(new URL("../fixtures/lever", import.meta.url));

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

describe("LeverAdapter", () => {
  it("discovers real recorded postings and parses them into structured jobs", async () => {
    const fetchImpl = fetchReturning(loadFixture("gynger-sample.json"));
    const adapter = createLeverAdapter("gynger", { fetchImpl });

    const { listings } = await adapter.discover({});
    expect(listings).toHaveLength(3);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.lever.co/v0/postings/gynger?mode=json",
    );

    const parsed = adapter.parse(listings[0]!);
    expect(parsed.company).toBe("gynger");
    expect(parsed.title).toBe("Account Executive");
    expect(parsed.location).toBe("New York City, NY");
    expect(parsed.url).toMatch(/^https:\/\/jobs\.lever\.co\//);
    expect(parsed.description.length).toBeGreaterThan(0);
    expect(parsed.postedAt).toBeInstanceOf(Date);
  });

  it("throws SOURCE_SCHEMA_DRIFT rather than inserting a partial row when text is missing", async () => {
    const adapter = createLeverAdapter("example", {
      fetchImpl: fetchReturning(loadFixture("missing-text.json")),
    });
    const { listings } = await adapter.discover({});
    try {
      adapter.parse(listings[0]!);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("SOURCE_SCHEMA_DRIFT");
    }
  });

  it("is tolerant of a posting with no location -- location becomes null, not a thrown error", async () => {
    const fixture = [
      { id: "abc", text: "Remote Engineer", hostedUrl: "https://jobs.lever.co/x/abc" },
    ];
    const adapter = createLeverAdapter("acme", { fetchImpl: fetchReturning(fixture) });
    const { listings } = await adapter.discover({});
    const parsed = adapter.parse(listings[0]!);
    expect(parsed.location).toBeNull();
  });

  it("declares its tier, capabilities, and rate limit", () => {
    const adapter = createLeverAdapter("gynger");
    expect(adapter.id).toBe("lever");
    expect(adapter.tier).toBe(1);
    expect(adapter.capabilities.fullDescription).toBe(true);
    expect(adapter.capabilities.requiresBrowser).toBe(false);
    expect(adapter.rateLimit.rps).toBeGreaterThan(0);
  });
});
