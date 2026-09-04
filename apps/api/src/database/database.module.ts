import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createDb, type Db } from "@jobhunter/db";
import type { AppEnv } from "../config/env.js";

export const DB = Symbol("DB");

/**
 * @Global so every feature module can @Inject(DB) without importing this
 * module explicitly. One pooled connection for the whole process -- both
 * the api and worker roles share this module (see app.module.ts), each
 * getting their own pool since main.ts and worker.ts are separate processes.
 */
@Global()
@Module({
  providers: [
    {
      provide: DB,
      useFactory: (configService: ConfigService<AppEnv, true>): Db =>
        createDb(
          configService.get("DATABASE_URL", { infer: true }),
          configService.get("DATABASE_POOL_MAX", { infer: true }),
        ),
      inject: [ConfigService],
    },
  ],
  exports: [DB],
})
export class DatabaseModule {}
