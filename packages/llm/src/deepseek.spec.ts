import { describe, expect, it, vi } from "vitest";
import { DeepSeekProvider } from "./deepseek.js";

/** Shaped exactly like a real DeepSeek response -- see the docs excerpt in packages/llm's design notes. */
function fakeResponse(
  overrides: Partial<{
    content: string;
    promptCacheHit: number;
    promptCacheMiss: number;
    completion: number;
  }> = {},
) {
  const promptCacheHit = overrides.promptCacheHit ?? 8000;
  const promptCacheMiss = overrides.promptCacheMiss ?? 2000;
  return {
    ok: true,
    status: 200,
    json: async () => ({
      id: "chatcmpl-test",
      object: "chat.completion",
      created: 1234567890,
      model: "deepseek-v4-flash",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: overrides.content ?? '{"ok":true}' },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: promptCacheHit + promptCacheMiss,
        completion_tokens: overrides.completion ?? 50,
        total_tokens: promptCacheHit + promptCacheMiss + (overrides.completion ?? 50),
        prompt_cache_hit_tokens: promptCacheHit,
        prompt_cache_miss_tokens: promptCacheMiss,
      },
    }),
    text: async () => "",
  } as unknown as Response;
}

describe("DeepSeekProvider", () => {
  it("constructs fine with no API key -- replay mode never calls complete() on this provider", () => {
    expect(() => new DeepSeekProvider({})).not.toThrow();
    expect(() => new DeepSeekProvider()).not.toThrow();
  });

  it("throws clearly if complete() is actually invoked with no API key", async () => {
    const provider = new DeepSeekProvider({});
    await expect(
      provider.complete({
        model: "deepseek-v4-flash",
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow(/DEEPSEEK_API_KEY is required/);
  });

  it("sends the correct endpoint, auth header, and request body shape", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse());
    const provider = new DeepSeekProvider({
      apiKey: "sk-test",
      fetchImpl,
      now: () => new Date("2026-09-09T12:00:00Z"),
    });

    await provider.complete({
      model: "deepseek-v4-flash",
      messages: [{ role: "user", content: "hi" }],
      temperature: 0,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.deepseek.com/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("deepseek-v4-flash");
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
  });

  it("sets response_format json_object when a responseSchema is given", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeResponse());
    const provider = new DeepSeekProvider({ apiKey: "sk-test", fetchImpl });

    await provider.complete({
      model: "deepseek-v4-flash",
      messages: [{ role: "user", content: "hi" }],
      responseSchema: { type: "object" },
    });

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("parses the cache-hit/cache-miss token split from a real-shaped response into usage", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        fakeResponse({ promptCacheHit: 9000, promptCacheMiss: 1000, completion: 200 }),
      );
    const provider = new DeepSeekProvider({
      apiKey: "sk-test",
      fetchImpl,
      now: () => new Date("2026-09-09T12:00:00Z"),
    });

    const result = await provider.complete({
      model: "deepseek-v4-flash",
      messages: [{ role: "user", content: "hi" }],
    });

    expect(result.usage).toEqual({
      promptTokens: 10000,
      completionTokens: 200,
      cacheHitTokens: 9000,
      cacheMissTokens: 1000,
    });
    expect(result.estimatedCostUsd).toBeGreaterThan(0);
  });

  it("throws with the response body on a non-ok HTTP status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "invalid api key",
    } as unknown as Response);
    const provider = new DeepSeekProvider({ apiKey: "sk-bad", fetchImpl });

    await expect(
      provider.complete({
        model: "deepseek-v4-flash",
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow(/401/);
  });
});
