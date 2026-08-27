/**
 * Foundation error types for the Guardian API.
 *
 * Principles:
 * - Known application errors carry a machine-readable code, an HTTP status,
 *   and a client-safe message (optionally with safe structured details).
 * - Unknown errors are NEVER reflected to clients. The route wrapper
 *   (lib/api.ts) logs full details server-side and returns a generic 500.
 *   Stack traces, internal paths, and credentials must never leak.
 */

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface AppErrorOptions {
  code: ApiErrorCode;
  status: number;
  message: string;
  /** Optional structured details that are safe to expose to the client. */
  details?: unknown;
}

/** Base class for all expected, client-safe application errors. */
export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = new.target.name;
    this.code = options.code;
    this.status = options.status;
    this.details = options.details;
  }
}

/** Request input failed validation. */
export class ValidationError extends AppError {
  constructor(message = "Request validation failed.", details?: unknown) {
    super({ code: "VALIDATION_ERROR", status: 400, message, details });
  }
}

/** Request is not authenticated (no session / stale / inactive identity). */
export class UnauthorizedError extends AppError {
  constructor(message = "Authentication is required.") {
    super({ code: "UNAUTHORIZED", status: 401, message });
  }
}

/** Authenticated but not allowed to perform this action. */
export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super({ code: "FORBIDDEN", status: 403, message });
  }
}

/** Requested resource does not exist (or belongs to another tenant). */
export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super({ code: "NOT_FOUND", status: 404, message: `${resource} not found.` });
  }
}

/** Canonical API error response body. */
export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId: string;
    details?: unknown;
  };
}

/**
 * Maps any thrown value onto the canonical API error body.
 * AppError subclasses expose their own message/status; everything else is
 * collapsed into a sanitized INTERNAL_ERROR.
 */
export function toApiErrorBody(
  error: unknown,
  requestId: string,
): { status: number; body: ApiErrorBody } {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          requestId,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
      },
    };
  }
  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
        requestId,
      },
    },
  };
}
