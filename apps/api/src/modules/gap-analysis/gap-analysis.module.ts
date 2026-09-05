import { Module } from "@nestjs/common";
import { LlmModule } from "../llm/llm.module.js";
import { GapAnalysisController } from "./gap-analysis.controller.js";
import { GapAnalysisService } from "./gap-analysis.service.js";

@Module({
  imports: [LlmModule],
  controllers: [GapAnalysisController],
  providers: [GapAnalysisService],
})
export class GapAnalysisModule {}
