import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { AppModule } from "../src/app.module.js";

/**
 * Boots the full AppModule, not just HealthModule in isolation --
 * HealthService depends on ConfigService, which only exists once
 * ConfigModule.forRoot() (registered in AppModule) has run. Points
 * DATABASE_URL at a closed local port so /ready deterministically observes
 * an unreachable database without requiring real infrastructure in this
 * unit-level e2e run.
 */
describe("Health (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    // DATABASE_URL / REDIS_URL come from vitest.e2e.config.ts's `test.env` --
    // they must be set before AppModule is imported (see that file's comment).
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health returns 200 without touching the database", async () => {
    const res = await request(app.getHttpServer()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("GET /ready returns 503 when the database is unreachable", async () => {
    const res = await request(app.getHttpServer()).get("/ready");
    expect(res.status).toBe(503);
  }, 10000);
});
