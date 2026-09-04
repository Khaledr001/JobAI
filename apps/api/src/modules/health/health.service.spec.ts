import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { beforeEach, describe, expect, it } from "vitest";
import { HealthService } from "./health.service.js";

describe("HealthService", () => {
  let service: HealthService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: ConfigService,
          useValue: { get: () => "postgres://invalid:invalid@localhost:1/invalid" },
        },
      ],
    }).compile();

    service = moduleRef.get(HealthService);
  });

  it("getHealth reports ok without touching the database", () => {
    expect(service.getHealth()).toEqual({ status: "ok" });
  });

  it("getReadiness reports not_ready when the database is unreachable", async () => {
    const result = await service.getReadiness();
    expect(result).toEqual({ status: "not_ready", database: "unreachable" });
  }, 10000);
});
