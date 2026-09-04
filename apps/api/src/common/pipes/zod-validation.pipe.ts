import { BadRequestException, type PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

/**
 * Per-route validation, not a global ValidationPipe. Zod schemas already
 * live in each module's dto.ts as the single source of truth for a shape --
 * duplicating them as class-validator decorators would be two definitions
 * of the same DTO to keep in sync.
 *
 * Usage: @Body(zodPipe(CreateWorkEntrySchema))
 */
export function zodPipe<T>(schema: ZodType<T>): PipeTransform<unknown, T> {
  return {
    transform(value: unknown): T {
      const result = schema.safeParse(value);
      if (!result.success) {
        throw new BadRequestException(result.error.flatten());
      }
      return result.data;
    },
  };
}
