import { z } from "zod";

/**
 * The only file that reads process.env directly (ESLint's no-restricted-syntax
 * rule enforces this everywhere else). Everything else in the app reads
 * `AppEnv` via ConfigService, so "which variables does this need" is always
 * answerable without grepping the tree.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_TIMEZONE: z.string().default("Asia/Dubai"),

  /**
   * api    HTTP only, no queue consumers
   * worker queue consumers only, no HTTP listener
   * all    both (development convenience only)
   */
  PROCESS_ROLE: z.enum(["api", "worker", "all"]).default("all"),

  DATABASE_URL: z.string().min(1),
  DATABASE_URL_MIGRATOR: z.string().min(1).optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  DATABASE_SSL: z.coerce.boolean().default(false),

  REDIS_URL: z.string().min(1),

  API_PORT: z.coerce.number().int().positive().default(3001),
  API_PREFIX: z.string().default("api/v1"),
  API_CORS_ORIGINS: z.string().default("http://localhost:3000"),
  THROTTLE_TTL: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(120),

  OPERATOR_EMAIL: z.string().email().optional(),
  OPERATOR_PASSWORD_HASH: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(1).optional(),
  JWT_ACCESS_TTL: z.string().default("30m"),
  JWT_REFRESH_SECRET: z.string().min(1).optional(),
  JWT_REFRESH_TTL: z.string().default("30d"),
  BCRYPT_ROUNDS: z.coerce.number().int().positive().default(12),

  LLM_MODE: z.enum(["live", "record", "replay"]).default("replay"),
  LLM_PROVIDER: z.string().default("deepseek"),
  DEEPSEEK_API_KEY: z.string().optional(),
  LLM_DAILY_BUDGET_USD: z.coerce.number().nonnegative().default(1),
  LLM_MONTHLY_BUDGET_USD: z.coerce.number().nonnegative().default(15),

  SOURCES_ENABLED: z.string().default(""),
  ADZUNA_APP_ID: z.string().optional(),
  ADZUNA_APP_KEY: z.string().optional(),

  IMAP_HOST: z.string().optional(),
  IMAP_USER: z.string().optional(),
  IMAP_APP_PASSWORD: z.string().optional(),
  SMTP_SEND_ENABLED: z.coerce.boolean().default(false),

  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),

  ASSIST_ENABLED: z.coerce.boolean().default(false),
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const result = EnvSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${result.error.message}`);
  }
  return result.data;
}
