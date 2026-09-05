import type { LlmModel } from "./provider.js";

/**
 * Verified against DeepSeek's live pricing (PLAN.md's "AI layer" section,
 * Sept 2026). Each pair is [off-peak, peak] USD per 1M tokens -- peak is
 * exactly double off-peak, not a separately-quoted number, so this table
 * only needs to store the off-peak rate and double it when
 * {@link isPeakUtc} says so.
 */
interface ModelRates {
  cacheHitPerMillion: number;
  cacheMissPerMillion: number;
  outputPerMillion: number;
}

const OFF_PEAK_RATES: Record<LlmModel, ModelRates> = {
  "deepseek-v4-flash": {
    cacheHitPerMillion: 0.007,
    cacheMissPerMillion: 0.22,
    outputPerMillion: 0.66,
  },
  "deepseek-v4-pro": {
    cacheHitPerMillion: 0.022,
    cacheMissPerMillion: 0.66,
    outputPerMillion: 1.98,
  },
};

/**
 * Peak = 01:00-04:00 and 06:00-10:00 UTC, Monday-Friday (PLAN.md). Outside
 * those windows -- including all of Saturday/Sunday -- is off-peak, at
 * half price. Takes the instant as a parameter rather than reading the
 * clock: this function is called from a pure cost-estimation path that
 * must stay testable without mocking `Date`.
 */
export function isPeakUtc(at: Date): boolean {
  const day = at.getUTCDay(); // 0 = Sunday, 6 = Saturday
  if (day === 0 || day === 6) return false;

  const hour = at.getUTCHours();
  return (hour >= 1 && hour < 4) || (hour >= 6 && hour < 10);
}

export interface UsageTokens {
  cacheHitTokens: number;
  cacheMissTokens: number;
  completionTokens: number;
}

/**
 * DeepSeek's own usage object reports the prompt-token cache split
 * directly (`prompt_cache_hit_tokens` / `prompt_cache_miss_tokens`) --
 * this never has to guess which tokens were cached, only price them
 * correctly for the time of day the call actually happened.
 */
export function estimateCostUsd(model: LlmModel, usage: UsageTokens, at: Date): number {
  const rates = OFF_PEAK_RATES[model];
  const multiplier = isPeakUtc(at) ? 2 : 1;

  const cost =
    (usage.cacheHitTokens / 1_000_000) * rates.cacheHitPerMillion * multiplier +
    (usage.cacheMissTokens / 1_000_000) * rates.cacheMissPerMillion * multiplier +
    (usage.completionTokens / 1_000_000) * rates.outputPerMillion * multiplier;

  return cost;
}
