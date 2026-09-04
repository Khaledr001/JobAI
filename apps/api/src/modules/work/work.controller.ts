import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { zodPipe } from "../../common/pipes/zod-validation.pipe.js";
import type { AuthenticatedUser } from "../auth/dto.js";
import { CreateWorkEntrySchema, type CreateWorkEntryDto } from "./dto.js";
import { WorkService } from "./work.service.js";

@Controller("work-entries")
export class WorkController {
  constructor(private readonly workService: WorkService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.workService.listWorkEntries(user.sub);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(zodPipe(CreateWorkEntrySchema)) dto: CreateWorkEntryDto,
  ) {
    return this.workService.createWorkEntry(user.sub, dto);
  }

  @Delete(":id")
  retract(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.workService.retractWorkEntry(user.sub, id);
  }

  @Get("technology-scores")
  technologyScores(@CurrentUser() user: AuthenticatedUser) {
    return this.workService.getTechnologyScores(user.sub);
  }
}
