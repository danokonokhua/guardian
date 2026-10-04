import type { MonitorType } from "@prisma/client";
import { AppError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { parseMonitorConfig, parseMonitorUpdate } from "@/lib/monitor-config";
import {
  createMonitor,
  deleteMonitor,
  findMonitor,
  listMonitors,
  updateMonitor,
  type MonitorRecord,
} from "@/services/monitors/repository";
import type { TenantScope } from "@/db/tenant";
import type { PgBoss } from "pg-boss";
import { getJobBoss, startJobBoss } from "@/lib/jobs/boss";
import {
  JOB_EXPIRE_SECONDS,
  JOB_RETRY_DELAY_SECONDS,
  JOB_RETRY_LIMIT,
  MONITOR_CHECK_JOB,
} from "@/lib/jobs/constants";

export function listConfiguredMonitors(scope: TenantScope): Promise<MonitorRecord[]> {
  return listMonitors(scope);
}

export async function configureMonitor(scope: TenantScope, input: unknown): Promise<MonitorRecord> {
  const parsed = parseMonitorConfig(input);
  try {
    return await createMonitor(
      scope,
      parsed as {
        websiteId: string;
        type: MonitorType;
        enabled: boolean;
        frequencyMinutes: number;
        config: object;
      },
    );
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: unknown }).code)
        : "";

    if (
      message.toLowerCase().includes("unique constraint") ||
      message.includes("23505") ||
      code === "P2002"
    ) {
      throw new ConflictError("A monitor of this type already exists for this website.");
    }

    if (
      message.includes("Website not found") ||
      message.includes("23503") ||
      code === "P2003" ||
      code === "P2025"
    ) {
      throw new NotFoundError("Website");
    }

    if (
      message.includes("invalid input value for enum") ||
      message.includes("23514") ||
      code === "P2000"
    ) {
      throw new ValidationError(`Invalid monitor check settings: ${message}`);
    }

    logger.error("configure_monitor_unexpected_error", {
      organizationId: scope.organizationId,
      error: message,
      code,
      stack: error instanceof Error ? error.stack : undefined,
    });

    throw new AppError({
      code: "BAD_REQUEST",
      status: 400,
      message: `Unable to configure monitor: ${message.replace(/^[\s\S]*?(?:PrismaClientKnownRequestError:\s*|\nInvalid `[\s\S]*?` invocation:?\s*)/, "").trim() || message}`,
    });
  }
}

export async function updateConfiguredMonitor(
  scope: TenantScope,
  monitorId: string,
  input: unknown,
): Promise<MonitorRecord> {
  const parsed = parseMonitorUpdate(input);
  const updated = await updateMonitor(scope, monitorId, parsed);
  if (!updated) throw new NotFoundError("Monitor");
  return updated;
}

export async function deleteConfiguredMonitor(
  scope: TenantScope,
  monitorId: string,
): Promise<void> {
  const deleted = await deleteMonitor(scope, monitorId);
  if (!deleted) throw new NotFoundError("Monitor");
}

/** Enqueues one immediate check after validating the monitor in the caller's tenant. */
export async function triggerConfiguredMonitor(
  scope: TenantScope,
  monitorId: string,
  boss?: PgBoss,
): Promise<{ monitorId: string; jobId: string | null }> {
  const monitor = await findMonitor(scope, monitorId);
  if (!monitor) throw new NotFoundError("Monitor");

  const jobBoss = boss ?? getJobBoss();
  if (boss === undefined) await startJobBoss();

  await jobBoss.createQueue(MONITOR_CHECK_JOB, {
    retryLimit: JOB_RETRY_LIMIT,
    retryDelay: JOB_RETRY_DELAY_SECONDS,
    retryBackoff: true,
    expireInSeconds: JOB_EXPIRE_SECONDS,
  });
  const jobId = await jobBoss.send(
    MONITOR_CHECK_JOB,
    {
      organizationId: scope.organizationId,
      websiteId: monitor.websiteId,
      monitorId: monitor.id,
      type: monitor.type,
    },
    {
      retryLimit: JOB_RETRY_LIMIT,
      retryDelay: JOB_RETRY_DELAY_SECONDS,
      retryBackoff: true,
      expireInSeconds: JOB_EXPIRE_SECONDS,
      singletonKey: `monitor:${monitor.id}`,
      singletonSeconds: Math.max(1, monitor.frequencyMinutes * 60),
    },
  );
  return { monitorId: monitor.id, jobId: jobId ?? null };
}
