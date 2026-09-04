import { PROJECT_STATUSES } from "@jobhunter/shared-types";
import { z } from "zod";

export const UpdateProfileSchema = z.object({
  headline: z.string().min(1).max(200).optional(),
  summary: z.string().min(1).max(2000).optional(),
  location: z.string().min(1).max(200).optional(),
});
export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;

const dateOnly = () => z.coerce.date();

export const CreateExperienceSchema = z.object({
  organizationName: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  location: z.string().max(200).optional(),
  startedOn: dateOnly(),
  endedOn: dateOnly().optional(),
  endsOpen: z.boolean().default(false),
  countsTowardTotal: z.boolean().default(true),
});
export type CreateExperienceDto = z.infer<typeof CreateExperienceSchema>;

export const UpdateExperienceSchema = CreateExperienceSchema.partial();
export type UpdateExperienceDto = z.infer<typeof UpdateExperienceSchema>;

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug must be lowercase-kebab-case"),
  description: z.string().max(2000).optional(),
  status: z.enum(PROJECT_STATUSES).default("active"),
  isCurrent: z.boolean().default(false),
});
export type CreateProjectDto = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = CreateProjectSchema.partial();
export type UpdateProjectDto = z.infer<typeof UpdateProjectSchema>;

export const CreateProjectEpochSchema = z.object({
  label: z.string().min(1).max(120),
  stackSummary: z.string().max(500).optional(),
  startedOn: dateOnly(),
  endedOn: dateOnly().optional(),
});
export type CreateProjectEpochDto = z.infer<typeof CreateProjectEpochSchema>;
