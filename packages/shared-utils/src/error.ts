/**
 * The one error type services throw -- never HttpException. A service is
 * called from a queue processor as often as from a controller, and HTTP
 * status codes are meaningless there. AllExceptionsFilter (apps/api) is the
 * single place that maps a code to a status, at the edge.
 */
export const ERROR_CODES = {
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  CONFLICT: "CONFLICT",
  // Domain-specific codes accrue here as phases land, e.g.
  // CLAIM_NOT_EMITTABLE, PROPOSAL_UNGROUNDED, LLM_BUDGET_EXCEEDED.
  INTERNAL: "INTERNAL",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}
