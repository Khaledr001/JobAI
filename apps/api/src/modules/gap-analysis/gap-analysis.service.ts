import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { runAsOwner, type Db } from "@jobhunter/db";
import { AppError, ERROR_CODES } from "@jobhunter/shared-utils";
import { DB } from "../../database/database.module.js";
import { LlmService } from "../llm/llm.service.js";
import {
  buildGapAnalysisPrompt,
  GAP_ANALYSIS_RESPONSE_JSON_SCHEMA,
} from "./prompts/gap-analysis.prompt.js";
import {
  GapAnalysisResultSchema,
  type AnalyzeGapDto,
  type GapAnalysisResult,
} from "./dto.js";

/**
 * Phase 4's first AI feature, deliberately read-only (PLAN.md Phase 4): it
 * never writes a claim, a conflict, or anything else -- it exercises the
 * whole LLM stack (budget guard, cassette replay, cost ledger) end to end
 * while being structurally unable to write anything wrong. The profile it
 * shows the model is exactly `v_emittable_claims` -- the same single gate
 * the resume generator will read from in Phase 8, so this feature can never
 * see (or leak) an unconfirmed or conflicted claim.
 */
@Injectable()
export class GapAnalysisService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly llmService: LlmService,
  ) {}

  async analyze(ownerId: string, dto: AnalyzeGapDto): Promise<GapAnalysisResult> {
    const claims = await runAsOwner(this.db, ownerId, (tx) =>
      tx.execute<{ subject: string; statement: string }>(
        sql`SELECT subject, statement FROM v_emittable_claims WHERE owner_id = ${ownerId}::uuid ORDER BY subject`,
      ),
    );

    const messages = buildGapAnalysisPrompt(
      claims.map((c) => ({ subject: c.subject, statement: c.statement })),
      dto.jobDescription,
    );

    const result = await this.llmService.complete(ownerId, "gap-analysis", {
      model: "deepseek-v4-flash",
      messages,
      temperature: 0,
      responseSchema: GAP_ANALYSIS_RESPONSE_JSON_SCHEMA,
    });

    let raw: unknown;
    try {
      raw = JSON.parse(result.content);
    } catch {
      throw new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        "Gap analysis response was not valid JSON",
      );
    }

    const parsed = GapAnalysisResultSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        `Gap analysis response failed schema validation: ${parsed.error.message}`,
      );
    }
    return parsed.data;
  }
}
