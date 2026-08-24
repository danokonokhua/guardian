import type { ApiErrorBody, ApiErrorCode } from "@/lib/errors";

export type { ApiErrorBody, ApiErrorCode };

/** Response body of `GET /api/health`. */
export interface HealthResponse {
  status: "ok";
  service: string;
  version: string;
  environment: string;
  timestamp: string;
  requestId: string;
}
