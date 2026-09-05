import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { validateEnv, type AppEnv } from "./config/env.js";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard.js";
import { DatabaseModule } from "./database/database.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { ClaimsModule } from "./modules/claims/claims.module.js";
import { ConflictsModule } from "./modules/conflicts/conflicts.module.js";
import { GapAnalysisModule } from "./modules/gap-analysis/gap-analysis.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { JobsModule } from "./modules/jobs/jobs.module.js";
import { LlmModule } from "./modules/llm/llm.module.js";
import { ProfileModule } from "./modules/profile/profile.module.js";
import { TaxonomyModule } from "./modules/taxonomy/taxonomy.module.js";
import { WorkModule } from "./modules/work/work.module.js";

/**
 * D5: one app, two entrypoints (main.ts / worker.ts), one module graph.
 * WorkerModule (registering @Processor() consumers, added from Phase 4
 * onward) is imported here only when PROCESS_ROLE !== "api", so an HTTP-only
 * deploy never spins up queue consumers and a worker-only deploy never binds
 * a port. Producers (BullModule.registerQueue) load unconditionally in both
 * roles.
 *
 * Reading process.env directly here -- rather than through ConfigService --
 * is the one deliberate exception to that rule (see eslint.config.mjs):
 * NestJS module composition (which modules are IN the array) is decided at
 * class-decoration time, before Nest's DI container exists to hand out a
 * validated config object.
 */
// eslint-disable-next-line no-restricted-syntax
const processRole = process.env.PROCESS_ROLE ?? "all";
void processRole; // referenced once WorkerModule exists; see comment above

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    // Registered ahead of auth: an unauthenticated login attempt is exactly
    // what needs rate-limiting most (D9's hosting decision puts this API on
    // a VPS eventually, behind Tailscale/basic_auth, but this is a second,
    // independent layer that costs nothing to have now).
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppEnv, true>) => [
        {
          ttl: configService.get("THROTTLE_TTL", { infer: true }) * 1000,
          limit: configService.get("THROTTLE_LIMIT", { infer: true }),
        },
      ],
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    ProfileModule,
    TaxonomyModule,
    WorkModule,
    ClaimsModule,
    ConflictsModule,
    LlmModule,
    GapAnalysisModule,
    JobsModule,
    // ...(processRole !== "api" ? [WorkerModule] : []),
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Global: there is exactly one operator and no anonymous read path.
    // @Public() (health, auth/login, auth/refresh) is the only exemption.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
