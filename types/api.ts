import type { ApiErrorBody, ApiErrorCode } from "@/lib/errors";

export type { ApiErrorBody, ApiErrorCode };

/** /api/v1 success envelope. */
export interface V1SuccessBody<TData> {
  data: TData;
  requestId: string;
}

/** /api/v1 health payload (`GET /api/v1/health`). */
export interface V1HealthData {
  status: "ok";
  service: string;
  version: string;
  environment: string;
  timestamp: string;
}

/** /api/v1 organization context payload (architectural test endpoint). */
export interface V1OrganizationContextData {
  organization: { id: string };
  member: { userId: string; email: string; role: string };
}
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
