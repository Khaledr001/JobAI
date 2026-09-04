import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";
import { AppError, ERROR_CODES } from "@jobhunter/shared-utils";

const CODE_TO_STATUS: Record<string, number> = {
  [ERROR_CODES.NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ERROR_CODES.VALIDATION_FAILED]: HttpStatus.BAD_REQUEST,
  [ERROR_CODES.UNAUTHORIZED]: HttpStatus.UNAUTHORIZED,
  [ERROR_CODES.FORBIDDEN]: HttpStatus.FORBIDDEN,
  [ERROR_CODES.CONFLICT]: HttpStatus.CONFLICT,
  [ERROR_CODES.INTERNAL]: HttpStatus.INTERNAL_SERVER_ERROR,
};

/**
 * The single place an AppError code becomes an HTTP status. Services never
 * import HttpException -- they throw AppError, because they're called from
 * queue processors as often as controllers, and HTTP status is meaningless
 * there. This filter is what makes that pattern safe on the HTTP side.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof AppError) {
      const status = CODE_TO_STATUS[exception.code] ?? HttpStatus.INTERNAL_SERVER_ERROR;
      response.status(status).json({
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response
        .status(status)
        .json({ error: { code: "HTTP_ERROR", message: exception.message } });
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : exception);
    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ error: { code: ERROR_CODES.INTERNAL, message: "Internal server error" } });
  }
}
