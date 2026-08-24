import packageJson from "@/package.json";

import { appConfig } from "@/config/env";
import { jsonResponse, withRoute, type RouteContext } from "@/lib/api";

/**
 * Application liveness endpoint.
 *
 * Deliberately cheap: no database, no external calls, no expensive work.
 * Its only purpose is to prove the application process is alive and serving.
 * (A readiness endpoint with dependency checks arrives with the database phase.)
 */
export const dynamic = "force-dynamic";

export const GET = withRoute(async (_request, { requestId }: RouteContext) =>
  jsonResponse({
    status: "ok",
    service: appConfig.serviceName,
    version: packageJson.version,
    environment: appConfig.appEnv,
    timestamp: new Date().toISOString(),
    requestId,
  }),
);
