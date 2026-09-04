import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { zodPipe } from "../../common/pipes/zod-validation.pipe.js";
import type { AuthenticatedUser } from "../auth/dto.js";
import {
  CreateExperienceSchema,
  CreateProjectEpochSchema,
  CreateProjectSchema,
  UpdateExperienceSchema,
  UpdateProfileSchema,
  UpdateProjectSchema,
  type CreateExperienceDto,
  type CreateProjectDto,
  type CreateProjectEpochDto,
  type UpdateExperienceDto,
  type UpdateProfileDto,
  type UpdateProjectDto,
} from "./dto.js";
import { ProfileService } from "./profile.service.js";

@Controller("profile")
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.profileService.getProfile(user.sub);
  }

  @Patch()
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body(zodPipe(UpdateProfileSchema)) dto: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(user.sub, dto);
  }

  @Get("experiences")
  listExperiences(@CurrentUser() user: AuthenticatedUser) {
    return this.profileService.listExperiences(user.sub);
  }

  @Post("experiences")
  createExperience(
    @CurrentUser() user: AuthenticatedUser,
    @Body(zodPipe(CreateExperienceSchema)) dto: CreateExperienceDto,
  ) {
    return this.profileService.createExperience(user.sub, dto);
  }

  @Patch("experiences/:id")
  updateExperience(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(zodPipe(UpdateExperienceSchema)) dto: UpdateExperienceDto,
  ) {
    return this.profileService.updateExperience(user.sub, id, dto);
  }

  @Get("projects")
  listProjects(@CurrentUser() user: AuthenticatedUser) {
    return this.profileService.listProjects(user.sub);
  }

  @Post("projects")
  createProject(
    @CurrentUser() user: AuthenticatedUser,
    @Body(zodPipe(CreateProjectSchema)) dto: CreateProjectDto,
  ) {
    return this.profileService.createProject(user.sub, dto);
  }

  @Patch("projects/:id")
  updateProject(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(zodPipe(UpdateProjectSchema)) dto: UpdateProjectDto,
  ) {
    return this.profileService.updateProject(user.sub, id, dto);
  }

  @Post("projects/:id/epochs")
  createProjectEpoch(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body(zodPipe(CreateProjectEpochSchema)) dto: CreateProjectEpochDto,
  ) {
    return this.profileService.createProjectEpoch(user.sub, id, dto);
  }
}
