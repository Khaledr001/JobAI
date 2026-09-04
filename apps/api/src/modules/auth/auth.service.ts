import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { schema, type Db } from "@jobhunter/db";
import { AppError, ERROR_CODES } from "@jobhunter/shared-utils";
import { DB } from "../../database/database.module.js";
import type { AppEnv } from "../../config/env.js";
import type { AuthenticatedUser, AuthTokens, LoginDto, RefreshDto } from "./dto.js";

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppEnv, true>,
  ) {}

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.email, dto.email),
    });
    // Same error for "no such user" and "wrong password" -- a distinct
    // message for the former would let a caller enumerate valid emails.
    if (!user || !(await compare(dto.password, user.passwordHash))) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, "Invalid email or password");
    }
    return this.issueTokens({ sub: user.id, email: user.email });
  }

  async refresh(dto: RefreshDto): Promise<AuthTokens> {
    let decoded: AuthenticatedUser;
    try {
      decoded = await this.jwtService.verifyAsync<AuthenticatedUser>(dto.refreshToken, {
        secret: this.configService.get("JWT_REFRESH_SECRET", { infer: true }),
      });
    } catch {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, "Invalid or expired refresh token");
    }
    // Re-sign from a clean payload, not the decoded one: verifyAsync's result
    // carries standard JWT claims (iat, exp, ...) alongside sub/email, and
    // signAsync rejects a payload that already has "exp" when `expiresIn` is
    // also given.
    return this.issueTokens({ sub: decoded.sub, email: decoded.email });
  }

  private async issueTokens(payload: AuthenticatedUser): Promise<AuthTokens> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get("JWT_ACCESS_SECRET", { infer: true }),
        expiresIn: this.configService.get("JWT_ACCESS_TTL", { infer: true }),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get("JWT_REFRESH_SECRET", { infer: true }),
        expiresIn: this.configService.get("JWT_REFRESH_TTL", { infer: true }),
      }),
    ]);
    return { accessToken, refreshToken };
  }
}
