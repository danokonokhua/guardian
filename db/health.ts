import "server-only";

/**
 * Database health/readiness probe.
 *
 * Safe by construction:
 * - Returns a coarse status only ("healthy" | "unconfigured" | "unhealthy").
 * - Never includes connection strings, hostnames, or raw Prisma error text in
 *   its RESULT — full diagnostics go to the server-side logger (which redacts
 *   sensitive keys) and never to API consumers.
 * - Time-boxed so a hanging connection cannot hang the health endpoint.
 */

import { serverConfig } from "@/config/server";
import { getPrisma } from "@/db/client";
import { logger } from "@/lib/logger";

export type DatabaseHealthStatus = "healthy" | "unconfigured" | "unhealthy";

export interface DatabaseHealth {
  readonly status: DatabaseHealthStatus;
  readonly latencyMs?: number;
}

const PROBE_TIMEOUT_MS = 1500;

export async function getDatabaseHealth(): Promise<DatabaseHealth> {
  if (serverConfig.server.databaseUrl === undefined) {
    // Database variables are optional in this phase; an unconfigured database
    // is a reportable state, not an error.
    return { status: "unconfigured" };
  }

  const start = Date.now();
  try {
    await Promise.race([
      getPrisma().$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) => {
        const timer = setTimeout(() => reject(new Error("probe timeout")), PROBE_TIMEOUT_MS);
        // Do not keep the process alive just for this guard.
        (timer as { unref?: () => void }).unref?.();
      }),
    ]);
    return { status: "healthy", latencyMs: Date.now() - start };
  } catch (error: unknown) {
    // Server-side diagnostics only; the API-facing result stays sanitized.
    logger.error("database_health_probe_failed", {
      latencyMs: Date.now() - start,
      error,
    });
    return { status: "unhealthy" };
  }
}
