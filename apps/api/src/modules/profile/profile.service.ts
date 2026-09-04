import { Inject, Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { runAsOwner, schema, type Db } from "@jobhunter/db";
import { AppError, ERROR_CODES } from "@jobhunter/shared-utils";
import { DB } from "../../database/database.module.js";
import type {
  CreateExperienceDto,
  CreateProjectDto,
  CreateProjectEpochDto,
  UpdateExperienceDto,
  UpdateProfileDto,
  UpdateProjectDto,
} from "./dto.js";

@Injectable()
export class ProfileService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async getProfile(ownerId: string) {
    return runAsOwner(this.db, ownerId, async (tx) => {
      const [profile, experiences, projects] = await Promise.all([
        tx.query.profiles.findFirst({ where: eq(schema.profiles.ownerId, ownerId) }),
        tx.query.experiences.findMany({
          where: eq(schema.experiences.ownerId, ownerId),
          orderBy: desc(schema.experiences.startedOn),
        }),
        tx.query.projects.findMany({
          where: eq(schema.projects.ownerId, ownerId),
          orderBy: desc(schema.projects.createdAt),
        }),
      ]);
      return { profile: profile ?? null, experiences, projects };
    });
  }

  async updateProfile(ownerId: string, dto: UpdateProfileDto) {
    return runAsOwner(this.db, ownerId, async (tx) => {
      const [row] = await tx
        .insert(schema.profiles)
        .values({ ownerId, ...dto })
        .onConflictDoUpdate({ target: schema.profiles.ownerId, set: dto })
        .returning();
      return row;
    });
  }

  async listExperiences(ownerId: string) {
    return runAsOwner(this.db, ownerId, (tx) =>
      tx.query.experiences.findMany({
        where: eq(schema.experiences.ownerId, ownerId),
        orderBy: desc(schema.experiences.startedOn),
      }),
    );
  }

  async createExperience(ownerId: string, dto: CreateExperienceDto) {
    return runAsOwner(this.db, ownerId, async (tx) => {
      const [row] = await tx
        .insert(schema.experiences)
        .values({ ownerId, ...dto })
        .returning();
      return row;
    });
  }

  async updateExperience(
    ownerId: string,
    experienceId: string,
    dto: UpdateExperienceDto,
  ) {
    return runAsOwner(this.db, ownerId, async (tx) => {
      const [row] = await tx
        .update(schema.experiences)
        .set(dto)
        .where(eq(schema.experiences.id, experienceId))
        .returning();
      if (!row) {
        throw new AppError(ERROR_CODES.NOT_FOUND, `Experience ${experienceId} not found`);
      }
      return row;
    });
  }

  async listProjects(ownerId: string) {
    return runAsOwner(this.db, ownerId, (tx) =>
      tx.query.projects.findMany({
        where: eq(schema.projects.ownerId, ownerId),
        orderBy: desc(schema.projects.createdAt),
        with: { epochs: true },
      }),
    );
  }

  async createProject(ownerId: string, dto: CreateProjectDto) {
    return runAsOwner(this.db, ownerId, async (tx) => {
      const [row] = await tx
        .insert(schema.projects)
        .values({ ownerId, ...dto })
        .returning();
      return row;
    });
  }

  async updateProject(ownerId: string, projectId: string, dto: UpdateProjectDto) {
    return runAsOwner(this.db, ownerId, async (tx) => {
      const [row] = await tx
        .update(schema.projects)
        .set(dto)
        .where(eq(schema.projects.id, projectId))
        .returning();
      if (!row) {
        throw new AppError(ERROR_CODES.NOT_FOUND, `Project ${projectId} not found`);
      }
      return row;
    });
  }

  async createProjectEpoch(
    ownerId: string,
    projectId: string,
    dto: CreateProjectEpochDto,
  ) {
    return runAsOwner(this.db, ownerId, async (tx) => {
      const project = await tx.query.projects.findFirst({
        where: eq(schema.projects.id, projectId),
      });
      if (!project) {
        throw new AppError(ERROR_CODES.NOT_FOUND, `Project ${projectId} not found`);
      }
      const [row] = await tx
        .insert(schema.projectEpochs)
        .values({ ownerId, projectId, ...dto })
        .returning();
      return row;
    });
  }
}
