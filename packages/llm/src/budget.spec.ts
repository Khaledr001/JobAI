import { describe, expect, it } from "vitest";
import { BudgetGuard, LlmBudgetExceededError } from "./budget.js";

describe("BudgetGuard", () => {
  it("throws when spent-today has already reached the daily budget", () => {
    const guard = new BudgetGuard(5);
    expect(() => guard.assertWithinBudget(5)).toThrow(LlmBudgetExceededError);
  });

  it("throws for any spend once the daily budget is 0 -- the Phase 4 acceptance test", () => {
    const guard = new BudgetGuard(0);
    expect(() => guard.assertWithinBudget(0)).toThrow(LlmBudgetExceededError);
  });

  it("does not throw while under budget", () => {
    const guard = new BudgetGuard(5);
    expect(() => guard.assertWithinBudget(4.99)).not.toThrow();
  });
});
