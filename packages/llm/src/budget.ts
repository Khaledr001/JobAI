/**
 * Reads as a plain check over a number the caller already looked up --
 * `packages/llm` stays transport-only (PLAN.md), so the actual "how much
 * has been spent today" query against the `llm_calls` ledger lives in
 * apps/api's llm module, not here. This keeps the guard callable with zero
 * IO and trivially testable, and keeps this package free of a
 * `@jobhunter/db` dependency.
 *
 * A prompt bug should cost a thrown `LLM_BUDGET_EXCEEDED`, not a card
 * statement -- this check runs BEFORE the request goes out, never after.
 */
export class LlmBudgetExceededError extends Error {
  constructor(
    public readonly spentTodayUsd: number,
    public readonly dailyBudgetUsd: number,
  ) {
    super(
      `LLM_BUDGET_EXCEEDED: $${spentTodayUsd.toFixed(4)} already spent today, ` +
        `budget is $${dailyBudgetUsd.toFixed(2)}. Set an independent hard cap at the ` +
        `provider dashboard too -- this in-app guard is code, and code has bugs.`,
    );
    this.name = "LlmBudgetExceededError";
  }
}

export class BudgetGuard {
  constructor(private readonly dailyBudgetUsd: number) {}

  /** Throws LlmBudgetExceededError if today's spend has already reached the daily budget. A budget of 0 always throws -- the Phase 4 acceptance test relies on this. */
  assertWithinBudget(spentTodayUsd: number): void {
    if (spentTodayUsd >= this.dailyBudgetUsd) {
      throw new LlmBudgetExceededError(spentTodayUsd, this.dailyBudgetUsd);
    }
  }
}
