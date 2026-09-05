/**
 * Provider abstraction over DeepSeek (D11). Keeping this narrow -- one
 * `complete` method -- is what preserves the option to route resume
 * generation (the step that sends the full CV) to a different provider
 * later without touching any caller.
 *
 * DeepSeek has no embeddings endpoint (D12) -- embeddings are a separate,
 * local concern in the ingestion/matching pipeline, not part of this
 * interface.
 */
export type LlmModel = "deepseek-v4-flash" | "deepseek-v4-pro";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmCompleteOptions {
  model: LlmModel;
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  /** JSON-schema-shaped, for structured extraction via response_format: json_object. */
  responseSchema?: Record<string, unknown>;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  /** DeepSeek reports this split directly -- see pricing.ts. Always cacheHit + cacheMiss === promptTokens. */
  cacheHitTokens: number;
  cacheMissTokens: number;
}

export interface LlmCompleteResult {
  content: string;
  usage: LlmUsage;
  estimatedCostUsd: number;
}

export interface LlmProvider {
  readonly id: string;
  complete(options: LlmCompleteOptions): Promise<LlmCompleteResult>;
}
