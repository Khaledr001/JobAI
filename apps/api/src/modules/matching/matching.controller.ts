import { Controller, Get, Param } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/dto.js";
import { MatchingService } from "./matching.service.js";

@Controller("matching")
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  @Get("jobs/:jobId")
  scoreJob(@CurrentUser() user: AuthenticatedUser, @Param("jobId") jobId: string) {
    return this.matchingService.scoreJob(user.sub, jobId);
  }
}
