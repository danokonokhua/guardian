import { serverConfig } from "@/config/server";
import { getDatabaseHealth } from "@/db/health";
import { jsonResponse, withRoute, type RouteContext } from "@/lib/api";

/**
 * Combined readiness endpoint: application + database health.
 *
 * Distinct from `GET /api/health` (cheap liveness — no dependencies touched).
 * Response codes:
 *   200 — application healthy AND database healthy or not-yet-configured
 *         (database variables are optional until Phase 1B-04 wires the schema)
 *   503 — application failure OR a CONFIGURED database that is unreachable
 *
 * The payload never includes connection strings, hostnames, credentials, or
 * raw database errors — only coarse statuses.
 */
export const dynamic = "force-dynamic";

export const GET = withRoute(async (_request, { requestId }: RouteContext) => {
  const database = await getDatabaseHealth();
  const application = { status: "healthy" as const };

  const ok = database.status !== "unhealthy";
  const overall = ok ? (database.status === "healthy" ? "ok" : "degraded") : "error";

  return jsonResponse(
    {
      status: overall,
      service: serverConfig.serviceName,
      environment: serverConfig.appEnv,
      checks: { application, database },
      timestamp: new Date().toISOString(),
      requestId,
    },
    ok ? 200 : 503,
  );
});
