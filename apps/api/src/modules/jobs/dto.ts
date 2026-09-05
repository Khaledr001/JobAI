import { JobSourceProviderSchema } from "@jobhunter/shared-types";
import { z } from "zod";

export const IngestJobsSchema = z.object({
  provider: JobSourceProviderSchema,
  /** The slug in the adapter's URL -- Greenhouse's board token or Lever's company slug. */
  boardToken: z.string().min(1).max(200),
});
export type IngestJobsDto = z.infer<typeof IngestJobsSchema>;
