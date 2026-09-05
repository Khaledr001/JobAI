import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { withCassette } from "./cassette.js";
import type { LlmCompleteOptions, LlmCompleteResult, LlmProvider } from "./provider.js";

const FAKE_RESULT: LlmCompleteResult = {
  content: "hello from the fake provider",
  usage: {
    promptTokens: 10,
    completionTokens: 5,
    cacheHitTokens: 10,
    cacheMissTokens: 0,
  },
  estimatedCostUsd: 0.000001,
};

function fakeProvider(): { provider: LlmProvider; callCount: () => number } {
  let calls = 0;
  return {
    provider: {
      id: "fake",
      async complete(_options: LlmCompleteOptions) {
        calls++;
        return FAKE_RESULT;
      },
    },
    callCount: () => calls,
  };
}

const REQUEST: LlmCompleteOptions = {
  model: "deepseek-v4-flash",
  messages: [{ role: "user", content: "say hello" }],
};

describe("withCassette", () => {
  let cassettesDir: string;

  beforeEach(() => {
    cassettesDir = mkdtempSync(join(tmpdir(), "jobhunter-cassette-test-"));
  });

  afterEach(() => {
    rmSync(cassettesDir, { recursive: true, force: true });
  });

  it("replay mode throws on a cassette miss and never calls the underlying provider", async () => {
    const { provider, callCount } = fakeProvider();
    const wrapped = withCassette(provider, { mode: "replay", cassettesDir });

    await expect(wrapped.complete(REQUEST)).rejects.toThrow(/Cassette miss/);
    expect(callCount()).toBe(0);
  });

  it("replay mode's miss error names the fix, not just the failure", async () => {
    const { provider } = fakeProvider();
    const wrapped = withCassette(provider, { mode: "replay", cassettesDir });

    await expect(wrapped.complete(REQUEST)).rejects.toThrow(/LLM_MODE=record/);
  });

  it("record mode calls the real provider once and writes a cassette file to disk", async () => {
    const { provider, callCount } = fakeProvider();
    const wrapped = withCassette(provider, { mode: "record", cassettesDir });

    const result = await wrapped.complete(REQUEST);
    expect(result).toEqual(FAKE_RESULT);
    expect(callCount()).toBe(1);

    const written = readdirSync(cassettesDir, { recursive: true }) as string[];
    expect(written.some((f) => f.endsWith(".json"))).toBe(true);
  });

  it("replay mode returns exactly what record mode wrote, without calling the provider again", async () => {
    const { provider, callCount } = fakeProvider();

    const recorder = withCassette(provider, { mode: "record", cassettesDir });
    await recorder.complete(REQUEST);
    expect(callCount()).toBe(1);

    const replayer = withCassette(provider, { mode: "replay", cassettesDir });
    const replayed = await replayer.complete(REQUEST);

    expect(replayed).toEqual(FAKE_RESULT);
    expect(callCount()).toBe(1); // still 1 -- replay never touched the underlying provider
  });

  it("live mode always calls the underlying provider and never writes to disk", async () => {
    const { provider, callCount } = fakeProvider();
    const wrapped = withCassette(provider, { mode: "live", cassettesDir });

    await wrapped.complete(REQUEST);
    await wrapped.complete(REQUEST);

    expect(callCount()).toBe(2);
    expect(existsSync(cassettesDir) && readdirSync(cassettesDir).length === 0).toBe(true);
  });

  it("a different seed produces a different cassette key, so a stale replay cannot silently match", async () => {
    const { provider } = fakeProvider();
    await withCassette(provider, { mode: "record", cassettesDir, seed: 1 }).complete(
      REQUEST,
    );

    await expect(
      withCassette(provider, { mode: "replay", cassettesDir, seed: 2 }).complete(REQUEST),
    ).rejects.toThrow(/Cassette miss/);
  });
});
