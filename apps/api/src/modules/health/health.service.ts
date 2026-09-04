import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import postgres from "postgres";
import type { AppEnv } from "../../config/env.js";
import type { HealthStatus, ReadyStatus } from "./dto.js";

/**
 * A dedicated, single-connection client for liveness probing -- not the
 * pooled app connection Phase 1's modules will use. Health checks must keep
 * working even if the main pool is saturated or misconfigured.
 */
@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly logger = new Logger(HealthService.name);
  private readonly probeClient: postgres.Sql;

  constructor(configService: ConfigService<AppEnv, true>) {
    this.probeClient = postgres(configService.get("DATABASE_URL", { infer: true }), {
      max: 1,
      connect_timeout: 3,
    });
  }

  getHealth(): HealthStatus {
    return { status: "ok" };
  }

  async getReadiness(): Promise<ReadyStatus> {
    try {
      await this.probeClient`select 1`;
      return { status: "ok", database: "connected" };
    } catch (err) {
      this.logger.warn(`Readiness check failed: ${(err as Error).message}`);
      return { status: "not_ready", database: "unreachable" };
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.probeClient.end({ timeout: 3 });
  }
}
