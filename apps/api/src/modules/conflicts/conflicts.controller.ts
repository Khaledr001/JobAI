import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { zodPipe } from "../../common/pipes/zod-validation.pipe.js";
import type { AuthenticatedUser } from "../auth/dto.js";
import { ResolveConflictSchema, type ResolveConflictDto } from "./dto.js";
import { ConflictsService } from "./conflicts.service.js";

@Controller("conflicts")
export class ConflictsController {
  constructor(private readonly conflictsService: ConflictsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.conflictsService.listConflicts(user.sub);
  }

  // 200, not POST's default 201: this transitions an existing conflict's
  // state, it doesn't create a new resource.
  @Post(":id/resolve")
  @HttpCode(HttpStatus.OK)
  resolve(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(zodPipe(ResolveConflictSchema)) dto: ResolveConflictDto,
  ) {
    return this.conflictsService.resolveConflict(user.sub, id, dto);
  }
}
