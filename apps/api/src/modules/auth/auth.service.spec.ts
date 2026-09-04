import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { hash } from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DB } from "../../database/database.module.js";
import { AuthService } from "./auth.service.js";

const CONFIG_VALUES: Record<string, string> = {
  JWT_ACCESS_SECRET: "test-only-access-secret-at-least-32-chars",
  JWT_ACCESS_TTL: "30m",
  JWT_REFRESH_SECRET: "test-only-refresh-secret-at-least-32-chars",
  JWT_REFRESH_TTL: "30d",
};

describe("AuthService", () => {
  let service: AuthService;
  let findFirst: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    findFirst = vi.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        JwtService,
        { provide: DB, useValue: { query: { users: { findFirst } } } },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => CONFIG_VALUES[key] },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it("rejects a login for an email that doesn't exist", async () => {
    findFirst.mockResolvedValue(undefined);
    await expect(
      service.login({ email: "nobody@example.com", password: "x" }),
    ).rejects.toThrow("Invalid email or password");
  });

  it("rejects a login with the wrong password", async () => {
    findFirst.mockResolvedValue({
      id: "user-1",
      email: "khaled@example.com",
      passwordHash: await hash("correct-password", 4),
    });
    await expect(
      service.login({ email: "khaled@example.com", password: "wrong-password" }),
    ).rejects.toThrow("Invalid email or password");
  });

  it("issues an access and refresh token for a correct login", async () => {
    findFirst.mockResolvedValue({
      id: "user-1",
      email: "khaled@example.com",
      passwordHash: await hash("correct-password", 4),
    });
    const tokens = await service.login({
      email: "khaled@example.com",
      password: "correct-password",
    });
    expect(tokens.accessToken).toEqual(expect.any(String));
    expect(tokens.refreshToken).toEqual(expect.any(String));
    expect(tokens.accessToken).not.toEqual(tokens.refreshToken);
  });

  it("issues a fresh access token from a valid refresh token", async () => {
    findFirst.mockResolvedValue({
      id: "user-1",
      email: "khaled@example.com",
      passwordHash: await hash("correct-password", 4),
    });
    const { refreshToken } = await service.login({
      email: "khaled@example.com",
      password: "correct-password",
    });
    const tokens = await service.refresh({ refreshToken });
    expect(tokens.accessToken).toEqual(expect.any(String));
  });

  it("rejects a refresh with a garbage token", async () => {
    await expect(service.refresh({ refreshToken: "not-a-real-jwt" })).rejects.toThrow(
      "Invalid or expired refresh token",
    );
  });
});
