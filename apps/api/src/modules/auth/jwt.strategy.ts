import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { AppEnv } from "../../config/env.js";
import type { AuthenticatedUser } from "./dto.js";

/**
 * Verifies the access token's signature and expiry only -- no database hit
 * per request. Revocation isn't a concept this system has yet (no stored
 * refresh-token table), which is a deliberate Phase 1 scope limit: a short
 * access-token TTL (JWT_ACCESS_TTL, default 30m) bounds the exposure.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(configService: ConfigService<AppEnv, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get("JWT_ACCESS_SECRET", { infer: true }),
    });
  }

  validate(payload: AuthenticatedUser): AuthenticatedUser {
    return payload;
  }
}
