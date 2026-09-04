import { TAXONOMY_NODE_KINDS } from "@jobhunter/shared-types";
import { z } from "zod";

export const ListTaxonomyNodesQuerySchema = z.object({
  kind: z.enum(TAXONOMY_NODE_KINDS).optional(),
});
export type ListTaxonomyNodesQueryDto = z.infer<typeof ListTaxonomyNodesQuerySchema>;
