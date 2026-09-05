import { Body, Controller, Post } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { zodPipe } from "../../common/pipes/zod-validation.pipe.js";
import type { AuthenticatedUser } from "../auth/dto.js";
import { AnalyzeGapSchema, type AnalyzeGapDto } from "./dto.js";
import { GapAnalysisService } from "./gap-analysis.service.js";

@Controller("gap-analysis")
export class GapAnalysisController {
  constructor(private readonly gapAnalysisService: GapAnalysisService) {}

  @Post()
  analyze(
    @CurrentUser() user: AuthenticatedUser,
    @Body(zodPipe(AnalyzeGapSchema)) dto: AnalyzeGapDto,
  ) {
    return this.gapAnalysisService.analyze(user.sub, dto);
  }
}
