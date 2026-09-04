import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnv } from "./config/env.js";
import { HealthModule } from "./modules/health/health.module.js";

/**
 * D5: one app, two entrypoints (main.ts / worker.ts), one module graph.
 * WorkerModule (registering @Processor() consumers, added from Phase 1
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
    HealthModule,
    // ...(processRole !== "api" ? [WorkerModule] : []),
  ],
})
export class AppModule {}
