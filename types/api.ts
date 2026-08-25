import type { ApiErrorBody, ApiErrorCode } from "@/lib/errors";

export type { ApiErrorBody, ApiErrorCode };

/** Response body of `GET /api/health` (application liveness only). */
export interface HealthResponse {
  status: "ok";
  service: string;
  version: string;
  environment: string;
  timestamp: string;
  requestId: string;
}

/** Response body of `GET /api/health/ready` (application + database readiness). */
export interface ReadyResponse {
  status: "ok" | "degraded" | "error";
  service: string;
  environment: string;
  checks: {
    application: { status: "healthy" | "unhealthy" };
    database: { status: "healthy" | "unconfigured" | "unhealthy"; latencyMs?: number };
  };
  timestamp: string;
  requestId: string;
}
