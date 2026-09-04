import { Module } from "@nestjs/common";
import { ProjectionService } from "./projection.service.js";
import { WorkController } from "./work.controller.js";
import { WorkService } from "./work.service.js";

@Module({
  controllers: [WorkController],
  providers: [WorkService, ProjectionService],
})
export class WorkModule {}
