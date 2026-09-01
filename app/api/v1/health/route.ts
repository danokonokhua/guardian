import { serverConfig } from "@/config/server";
import { apiSuccess, withApiRoute } from "@/lib/api";
import packageJson from "@/package.json";

/**
 * `/api/v1/health` — non-sensitive liveness in the v1 response contract.
 * Cheap by design: no dependencies touched, no environment details beyond a
 * coarse deployment label.
 */
export const dynamic = "force-dynamic";

export const GET = withApiRoute(async (_request, { requestId }) =>
  apiSuccess(
    {
      status: "ok" as const,
      service: serverConfig.serviceName,
      version: packageJson.version,
      environment: serverConfig.appEnv,
      timestamp: new Date().toISOString(),
    },
    requestId,
  ),
);
