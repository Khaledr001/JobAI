import { Body, Controller, Get, Post } from "@nestjs/common";
import { AppError, ERROR_CODES } from "@jobhunter/shared-utils";
import {
  createGreenhouseAdapter,
  createLeverAdapter,
  type JobSourceAdapter,
} from "@jobhunter/sources";
import { zodPipe } from "../../common/pipes/zod-validation.pipe.js";
import { IngestJobsSchema, type IngestJobsDto } from "./dto.js";
import { JobsService } from "./jobs.service.js";

function adapterFor(dto: IngestJobsDto): JobSourceAdapter {
  switch (dto.provider) {
    case "greenhouse":
      return createGreenhouseAdapter(dto.boardToken);
    case "lever":
      return createLeverAdapter(dto.boardToken);
    default:
      throw new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        `Unsupported job source provider: ${String(dto.provider)}`,
      );
  }
}

@Controller("jobs")
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post("ingest")
  ingest(@Body(zodPipe(IngestJobsSchema)) dto: IngestJobsDto) {
    return this.jobsService.ingestFromAdapter(adapterFor(dto));
  }

  @Get()
  list() {
    return this.jobsService.listCanonicalJobs();
  }
}
