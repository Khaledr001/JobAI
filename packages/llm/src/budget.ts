/**
 * STUB -- Phase 4. Will read the append-only llm_calls ledger and throw
 * LLM_BUDGET_EXCEEDED before a request goes out once LLM_DAILY_BUDGET_USD is
 * reached, per PLAN.md's Queues section. A prompt bug should cost a thrown
 * error, not a card statement.
 */
export class BudgetGuard {
  constructor(private readonly dailyBudgetUsd: number) {}

  assertWithinBudget(spentTodayUsd: number): void {
    throw new Error(
      `BudgetGuard: not yet implemented (Phase 4) -- called with spentTodayUsd=${spentTodayUsd}, ` +
        `dailyBudgetUsd=${this.dailyBudgetUsd}`,
    );
  }
}
