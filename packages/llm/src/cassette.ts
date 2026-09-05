import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { LlmCompleteOptions, LlmCompleteResult, LlmProvider } from "./provider.js";

export type LlmMode = "live" | "record" | "replay";

/**
 * Recorded exactly once per distinct (provider, model, temperature, seed,
 * messages, schema) tuple -- the same key `withCassette` computes at
 * lookup time (PLAN.md's Verification section). Cassettes must be
 * recorded against a synthetic profile, never the real CV: a cassette
 * contains the prompt, and the prompt contains whatever profile summary
 * was interpolated into it (see docs/PRIVACY.md; `check-privacy.mjs`
 * scans every cassette file for the operator's real PII).
 */
interface CassetteFile {
  key: string;
  provider: string;
  model: string;
  request: {
    messages: LlmCompleteOptions["messages"];
    temperature: number;
    responseSchema: Record<string, unknown> | null;
  };
  result: LlmCompleteResult;
  recordedAt: string;
}

/**
 * Exported (not just an internal helper of `withCassette`) so a caller that
 * needs to record the exact cache key a real completion used -- Phase 9's
 * `documents.cassetteKey` column, frozen into an application's immutable
 * approval snapshot -- can compute it independently, with the exact same
 * inputs it already has in hand, rather than plumbing the key back out of
 * `LlmCompleteResult` (which is deliberately transport-only, PLAN.md's
 * packages/llm boundary).
 */
export function computeCassetteKey(
  providerId: string,
  options: LlmCompleteOptions,
  seed: number,
): string {
  const canonical = JSON.stringify({
    provider: providerId,
    model: options.model,
    temperature: options.temperature ?? 0,
    seed,
    messages: options.messages,
    responseSchema: options.responseSchema ?? null,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function cassettePath(cassettesDir: string, key: string): string {
  return join(cassettesDir, key.slice(0, 2), `${key}.json`);
}

export interface CassetteOptions {
  mode: LlmMode;
  cassettesDir: string;
  /** LLM_SEED -- part of the cache key so a deliberate seed bump can force a fresh recording. */
  seed?: number;
}

/**
 * Wraps any `LlmProvider` with record/replay. `replay` (forced in tests
 * and CI) never falls through to a live call on a miss -- it throws, with
 * the exact fix in the message. This is the one property the whole
 * anti-surprise-spend design rests on; get this wrong and a test suite
 * quietly starts costing money.
 */
export function withCassette(
  provider: LlmProvider,
  options: CassetteOptions,
): LlmProvider {
  const seed = options.seed ?? 1;

  return {
    id: provider.id,
    async complete(completeOptions: LlmCompleteOptions): Promise<LlmCompleteResult> {
      const key = computeCassetteKey(provider.id, completeOptions, seed);
      const path = cassettePath(options.cassettesDir, key);

      if (options.mode === "live") {
        return provider.complete(completeOptions);
      }

      if (options.mode === "replay") {
        if (!existsSync(path)) {
          throw new Error(
            `Cassette miss for ${provider.id}/${completeOptions.model} (key ${key}). ` +
              `LLM_MODE=replay never falls through to a live call. ` +
              `Re-record it with: LLM_MODE=record (and a real DEEPSEEK_API_KEY) re-running this call. ` +
              `Expected file: ${path}`,
          );
        }
        const file = JSON.parse(readFileSync(path, "utf8")) as CassetteFile;
        return file.result;
      }

      // record
      const result = await provider.complete(completeOptions);
      const file: CassetteFile = {
        key,
        provider: provider.id,
        model: completeOptions.model,
        request: {
          messages: completeOptions.messages,
          temperature: completeOptions.temperature ?? 0,
          responseSchema: completeOptions.responseSchema ?? null,
        },
        result,
        recordedAt: new Date().toISOString(),
      };
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(file, null, 2));
      return result;
    },
  };
}
