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
  /** A source adapter's raw payload is missing a field its parser requires -- see packages/sources. Never insert a partial row instead. */
  SOURCE_SCHEMA_DRIFT: "SOURCE_SCHEMA_DRIFT",
  /** A generated document failed @jobhunter/claims' validate() twice (the original draft and one retry-with-violations) -- surfaced to the operator instead of ever being persisted or rendered. */
  DOCUMENT_VALIDATION_FAILED: "DOCUMENT_VALIDATION_FAILED",
  /** Requested application status change isn't a legal move from the application's current status -- see @jobhunter/shared-utils' APPLICATION_TRANSITIONS. */
  ILLEGAL_APPLICATION_TRANSITION: "ILLEGAL_APPLICATION_TRANSITION",
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
