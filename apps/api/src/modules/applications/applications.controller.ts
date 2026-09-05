import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { zodPipe } from "../../common/pipes/zod-validation.pipe.js";
import type { AuthenticatedUser } from "../auth/dto.js";
import {
  CreateApplicationSchema,
  TransitionApplicationSchema,
  type CreateApplicationDto,
  type TransitionApplicationDto,
} from "./dto.js";
import { ApplicationsService } from "./applications.service.js";

@Controller("applications")
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.applicationsService.list(user.sub);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.applicationsService.get(user.sub, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(zodPipe(CreateApplicationSchema)) dto: CreateApplicationDto,
  ) {
    return this.applicationsService.create(user.sub, dto);
  }

  // 200, not POST's default 201: this transitions an existing resource's
  // state, it doesn't create a new one (same convention as conflicts/resolve).
  @Post(":id/transition")
  @HttpCode(HttpStatus.OK)
  transition(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(zodPipe(TransitionApplicationSchema)) dto: TransitionApplicationDto,
  ) {
    return this.applicationsService.transition(user.sub, id, dto);
  }
}
