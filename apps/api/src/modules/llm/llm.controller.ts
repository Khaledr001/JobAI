import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/dto.js";
import type { AppEnv } from "../../config/env.js";
import { LlmService } from "./llm.service.js";
import type { SpendTodayResponse } from "./dto.js";

/** A lightweight cost-monitoring endpoint -- checking today's spend without a DB client. */
@Controller("llm")
export class LlmController {
  constructor(
    private readonly llmService: LlmService,
    private readonly configService: ConfigService<AppEnv, true>,
  ) {}

  @Get("spend-today")
  async spendToday(@CurrentUser() user: AuthenticatedUser): Promise<SpendTodayResponse> {
    return {
      spentTodayUsd: await this.llmService.getSpentTodayUsd(user.sub),
      dailyBudgetUsd: this.configService.get("LLM_DAILY_BUDGET_USD", { infer: true }),
    };
  }
}
