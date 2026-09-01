import { timingSafeEqual } from "node:crypto";

import { withRoute } from "@/lib/api";
import { AppError, UnauthorizedError } from "@/lib/errors";
import { enqueueSystemPing } from "@/lib/jobs/system-ping";
import { serverConfig } from "@/config/server";

function hasValidCronSecret(request: Request, configuredSecret: string): boolean {
  const authorization = request.headers.get("authorization");
  if (authorization === null || !authorization.startsWith("Bearer ")) {
    return false;
  }

  const supplied = authorization.slice("Bearer ".length);
  const expected = Buffer.from(configuredSecret, "utf8");
  const actual = Buffer.from(supplied, "utf8");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Guarded scheduler tick. This endpoint only submits the foundation job;
 * actual processing belongs to the long-running worker.
 */
export const POST = withRoute(async (request, context) => {
  const cronSecret = serverConfig.server.cronSecret;
  if (cronSecret === undefined) {
    throw new AppError({
      code: "INTERNAL_ERROR",
      status: 503,
      message: "The scheduler is not configured.",
    });
  }

  if (!hasValidCronSecret(request, cronSecret)) {
    throw new UnauthorizedError("Cron authentication is required.");
  }

  const result = await enqueueSystemPing();
  return new Response(JSON.stringify({ data: result }), {
    status: 202,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-request-id": context.requestId,
    },
  });
});
