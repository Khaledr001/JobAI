import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, eq, gte, sql } from "drizzle-orm";
import { runAsOwner, schema, type Db } from "@jobhunter/db";
import {
  BudgetGuard,
  type LlmCompleteOptions,
  type LlmCompleteResult,
  type LlmMode,
  type LlmProvider,
} from "@jobhunter/llm";
import { AppError, ERROR_CODES } from "@jobhunter/shared-utils";
import { DB } from "../../database/database.module.js";
import { LLM_PROVIDER } from "./llm-provider.token.js";
import type { AppEnv } from "../../config/env.js";

/**
 * The one place every feature calls into DeepSeek through -- provider,
 * cassette wrapping, and the daily budget check all happen here, so no
 * feature module can accidentally skip the budget guard or bypass
 * `LLM_MODE=replay` by constructing its own provider. See PLAN.md's "AI
 * layer" section: `packages/llm` stays transport-only; this service is
 * where the DB-backed pieces (the cost ledger, "spent today") live.
 */
@Injectable()
export class LlmService {
  private readonly budgetGuard: BudgetGuard;
  private readonly mode: LlmMode;

  constructor(
    @Inject(LLM_PROVIDER) private readonly provider: LlmProvider,
    configService: ConfigService<AppEnv, true>,
    @Inject(DB) private readonly db: Db,
  ) {
    this.mode = configService.get("LLM_MODE", { infer: true });
    this.budgetGuard = new BudgetGuard(
      configService.get("LLM_DAILY_BUDGET_USD", { infer: true }),
    );
  }

  /**
   * `feature` names the caller (e.g. "gap-analysis") for cost breakdown
   * later. The budget check runs, and can throw, BEFORE `this.provider.complete()`
   * -- in `live` mode that means before any HTTP request; the Phase 4
   * acceptance test (`LLM_DAILY_BUDGET_USD=0` throws before any HTTP
   * request) is this ordering, not a special case of it.
   */
  async complete(
    ownerId: string,
    feature: string,
    options: LlmCompleteOptions,
  ): Promise<LlmCompleteResult> {
    const spentTodayUsd = await this.getSpentTodayUsd(ownerId);
    try {
      this.budgetGuard.assertWithinBudget(spentTodayUsd);
    } catch (err) {
      throw new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        err instanceof Error ? err.message : "LLM_BUDGET_EXCEEDED",
      );
    }

    const startedAt = performance.now();
    const result = await this.provider.complete(options);
    const latencyMs = Math.round(performance.now() - startedAt);

    await this.recordCall(ownerId, feature, options.model, result, latencyMs);
    return result;
  }

  async getSpentTodayUsd(ownerId: string): Promise<number> {
    return runAsOwner(this.db, ownerId, async (tx) => {
      const startOfDayUtc = new Date();
      startOfDayUtc.setUTCHours(0, 0, 0, 0);

      const [row] = await tx
        .select({
          total: sql<string>`COALESCE(SUM(${schema.llmCalls.estimatedCostUsd}), 0)`,
        })
        .from(schema.llmCalls)
        .where(
          and(
            eq(schema.llmCalls.ownerId, ownerId),
            gte(schema.llmCalls.createdAt, startOfDayUtc),
          ),
        );

      return Number(row?.total ?? 0);
    });
  }

  private async recordCall(
    ownerId: string,
    feature: string,
    model: string,
    result: LlmCompleteResult,
    latencyMs: number,
  ): Promise<void> {
    await runAsOwner(this.db, ownerId, (tx) =>
      tx.insert(schema.llmCalls).values({
        ownerId,
        provider: "deepseek",
        model,
        feature,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        cacheHitTokens: result.usage.cacheHitTokens,
        cacheMissTokens: result.usage.cacheMissTokens,
        estimatedCostUsd: result.estimatedCostUsd.toFixed(6),
        latencyMs,
        cassetteMode: this.mode,
      }),
    );
  }
}
