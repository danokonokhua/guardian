/**
 * Route-handler helpers: request IDs, JSON responses, and a consistent
 * error boundary for API routes.
 *
 * Two boundaries exist:
 * - `withRoute`  — legacy/foundation endpoints (bare JSON, pre-/api/v1).
 * - `withApiRoute` — the /api/v1 contract: validated client request-ID
 *   propagation, `{ data, requestId }` success envelope via `apiSuccess`,
 *   canonical error envelope, and `x-request-id` on every response.
 */
import { randomUUID } from "node:crypto";

import { AppError, toApiErrorBody } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { captureUnexpectedError } from "@/lib/observability/sentry";

export interface RouteContext {
  requestId: string;
}

export type RouteHandler = (request: Request, context: RouteContext) => Promise<Response>;

/** Extended context handed to /api/v1 handlers (dynamic params resolved). */
export interface ApiRouteContext extends RouteContext {
  params: Record<string, string>;
}

export type ApiRouteHandler = (request: Request, context: ApiRouteContext) => Promise<Response>;

const JSON_HEADERS: Record<string, string> = { "content-type": "application/json; charset=utf-8" };

/** Accepted client request IDs: safe charset, 8–64 chars, alnum-led. */
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{7,63}$/;

export function newRequestId(): string {
  return randomUUID();
}

/**
 * Resolves the response request ID: a client-supplied `x-request-id` is
 * propagated ONLY when it matches the safe pattern (no oversized, malformed,
 * or injection-capable values); otherwise a server-side UUID is generated.
 */
export function resolveRequestId(request: Request): string {
  const header = request.headers.get("x-request-id");
  if (header !== null && REQUEST_ID_PATTERN.test(header)) {
    return header;
  }
  return newRequestId();
}

/** /api/v1 success envelope. */
export function apiSuccess<TData>(data: TData, requestId: string, status = 200): Response {
  return jsonResponse({ data, requestId }, status, { "x-request-id": requestId });
}

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}

/**
 * Shared error-classification policy: expected 4xx business outcomes are not
 * observability events; unknown errors and 5xx AppErrors are captured (when
 * Sentry is configured) alongside the structured log.
 */
function reportUnexpectedError(error: unknown, requestId: string): void {
  logger.error("api_route_unhandled_error", { requestId, error });
  const isExpectedClientError = error instanceof AppError && error.status < 500;
  if (!isExpectedClientError) {
    captureUnexpectedError(error, { requestId });
  }
}

/**
 * Wraps an API route handler with the Guardian error boundary:
 * - assigns a request id,
 * - logs unexpected failures server-side with full detail,
 * - returns the canonical, sanitized error body to the client
 *   (never stack traces, secrets, or internal paths).
 */
export function withRoute(handler: RouteHandler): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const requestId = newRequestId();
    try {
      return await handler(request, { requestId });
    } catch (error: unknown) {
      reportUnexpectedError(error, requestId);
      const { status, body } = toApiErrorBody(error, requestId);
      return jsonResponse(body, status, { "x-request-id": requestId });
    }
  };
}

/**
 * Error boundary for /api/v1 route handlers. Resolves the request ID
 * (validated propagation or generation), awaits dynamic route params, runs
 * the handler, and converts any thrown value into the canonical sanitized
 * error envelope with `x-request-id` set on every response.
 */
export function withApiRoute(
  handler: ApiRouteHandler,
): (
  request: Request,
  routeCtx?: { params?: Promise<Record<string, string>> },
) => Promise<Response> {
  return async (request: Request, routeCtx?: { params?: Promise<Record<string, string>> }) => {
    const requestId = resolveRequestId(request);
    try {
      const params = (await routeCtx?.params) ?? {};
      return await handler(request, { requestId, params });
    } catch (error: unknown) {
      reportUnexpectedError(error, requestId);
      const { status, body } = toApiErrorBody(error, requestId);
      return jsonResponse(body, status, { "x-request-id": requestId });
    }
  };
}
