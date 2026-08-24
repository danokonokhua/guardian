/**
 * Route-handler helpers: request IDs, JSON responses, and a consistent
 * error boundary for API routes.
 */
import { randomUUID } from "node:crypto";

import { toApiErrorBody } from "@/lib/errors";
import { logger } from "@/lib/logger";

export interface RouteContext {
  requestId: string;
}

export type RouteHandler = (request: Request, context: RouteContext) => Promise<Response>;

const JSON_HEADERS: Record<string, string> = { "content-type": "application/json; charset=utf-8" };

export function newRequestId(): string {
  return randomUUID();
}

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
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
      logger.error("api_route_unhandled_error", { requestId, error });
      const { status, body } = toApiErrorBody(error, requestId);
      return jsonResponse(body, status, { "x-request-id": requestId });
    }
  };
}
