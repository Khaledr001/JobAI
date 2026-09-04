import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginDto = z.infer<typeof LoginSchema>;

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshDto = z.infer<typeof RefreshSchema>;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** The shape passport-jwt's JwtStrategy.validate() returns, and what @CurrentUser() hands controllers. */
export interface AuthenticatedUser {
  sub: string;
  email: string;
}
