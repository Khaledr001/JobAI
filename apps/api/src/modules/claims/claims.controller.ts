import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { zodPipe } from "../../common/pipes/zod-validation.pipe.js";
import type { AuthenticatedUser } from "../auth/dto.js";
import {
  AttachEvidenceSchema,
  ConfirmClaimSchema,
  CreateClaimSchema,
  type AttachEvidenceDto,
  type ConfirmClaimDto,
  type CreateClaimDto,
} from "./dto.js";
import { ClaimsService } from "./claims.service.js";

@Controller("claims")
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.claimsService.listClaims(user.sub);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(zodPipe(CreateClaimSchema)) dto: CreateClaimDto,
  ) {
    return this.claimsService.createClaim(user.sub, dto);
  }

  @Post(":id/evidence")
  attachEvidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(zodPipe(AttachEvidenceSchema)) dto: AttachEvidenceDto,
  ) {
    return this.claimsService.attachEvidence(user.sub, id, dto);
  }

  // 200, not POST's default 201: this transitions an existing claim's
  // state, it doesn't create a new resource.
  @Post(":id/confirm")
  @HttpCode(HttpStatus.OK)
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(zodPipe(ConfirmClaimSchema)) dto: ConfirmClaimDto,
  ) {
    return this.claimsService.confirmClaim(user.sub, id, dto.verification);
  }

  @Post(":id/reject")
  @HttpCode(HttpStatus.OK)
  reject(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.claimsService.rejectClaim(user.sub, id);
  }
}
