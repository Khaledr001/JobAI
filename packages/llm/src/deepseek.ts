import { estimateCostUsd } from "./pricing.js";
import type { LlmCompleteOptions, LlmCompleteResult, LlmProvider } from "./provider.js";

const BASE_URL = "https://api.deepseek.com";

/** Shape of DeepSeek's chat completion response -- verified against their live API docs (Sept 2026). Only the fields this provider reads. */
interface DeepSeekResponse {
  choices: Array<{ message: { content: string | null } }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    prompt_cache_hit_tokens: number;
    prompt_cache_miss_tokens: number;
  };
}

export interface DeepSeekProviderOptions {
  /**
   * Optional at construction time on purpose: a `LlmService` wired for
   * `LLM_MODE=replay` (every test run, CI) constructs this provider but
   * `withCassette()`'s replay path never calls `complete()` on it, so
   * requiring a real key here would fail DI bootstrap in every environment
   * that has no `DEEPSEEK_API_KEY` set. The check that matters -- "a live
   * call with no key fails clearly" -- lives in `complete()` instead, at
   * the one point a key is actually needed.
   */
  apiKey?: string;
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Injectable for tests, so cost estimation isn't a race with the real clock. */
  now?: () => Date;
}

/**
 * The real DeepSeek client. Never called directly by application code --
 * every caller goes through `withCassette()` (cassette.ts), which is what
 * makes `LLM_MODE=replay` actually prevent a network call from ever
 * happening in tests and CI.
 */
export class DeepSeekProvider implements LlmProvider {
  readonly id = "deepseek";
  private readonly apiKey: string | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;

  constructor(options: DeepSeekProviderOptions = {}) {
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
  }

  async complete(options: LlmCompleteOptions): Promise<LlmCompleteResult> {
    if (!this.apiKey) {
      throw new Error(
        "DeepSeekProvider: DEEPSEEK_API_KEY is required for a live call. " +
          "If this is a test, LLM_MODE should be 'replay' -- withCassette() would have " +
          "returned a recorded result without ever reaching this check.",
      );
    }

    const body: Record<string, unknown> = {
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0,
    };
    if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;
    if (options.responseSchema) body.response_format = { type: "json_object" };

    const res = await this.fetchImpl(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`DeepSeek API error ${res.status}: ${text.slice(0, 500)}`);
    }

    const data = (await res.json()) as DeepSeekResponse;
    const content = data.choices[0]?.message.content;
    if (content === null || content === undefined) {
      throw new Error("DeepSeek API returned no message content.");
    }

    const usage = {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      cacheHitTokens: data.usage.prompt_cache_hit_tokens,
      cacheMissTokens: data.usage.prompt_cache_miss_tokens,
    };

    return {
      content,
      usage,
      estimatedCostUsd: estimateCostUsd(
        options.model,
        {
          cacheHitTokens: usage.cacheHitTokens,
          cacheMissTokens: usage.cacheMissTokens,
          completionTokens: usage.completionTokens,
        },
        this.now(),
      ),
    };
  }
}
