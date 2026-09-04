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
export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmCompleteOptions {
  model: "deepseek-v4-flash" | "deepseek-v4-pro";
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  /** JSON-schema-shaped, for structured extraction. */
  responseSchema?: Record<string, unknown>;
}

export interface LlmCompleteResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
}

export interface LlmProvider {
  readonly id: string;
  complete(options: LlmCompleteOptions): Promise<LlmCompleteResult>;
}

/**
 * STUB -- Phase 4 implements the real DeepSeek client plus the cassette
 * record/replay transport (LLM_MODE=live|record|replay). Throws rather than
 * silently returning fake data, so nothing can mistake this for a working
 * integration.
 */
export class DeepSeekProvider implements LlmProvider {
  readonly id = "deepseek";

  complete(_options: LlmCompleteOptions): Promise<LlmCompleteResult> {
    throw new Error("DeepSeekProvider: not yet implemented (Phase 4)");
  }
}
