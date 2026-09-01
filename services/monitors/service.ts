import type { MonitorType } from "@prisma/client";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { parseMonitorConfig, parseMonitorUpdate } from "@/lib/monitor-config";
import {
  createMonitor,
  findMonitor,
  listMonitors,
  updateMonitor,
  type MonitorRecord,
} from "@/services/monitors/repository";
import type { TenantScope } from "@/db/tenant";
import type { PgBoss } from "pg-boss";
import { getJobBoss } from "@/lib/jobs/boss";
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
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      throw new ConflictError("A monitor of this type already exists for this website.");
    }
    throw error;
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

/** Enqueues one immediate check after validating the monitor in the caller's tenant. */
export async function triggerConfiguredMonitor(
  scope: TenantScope,
  monitorId: string,
  boss?: PgBoss,
): Promise<{ monitorId: string; jobId: string | null }> {
  const monitor = await findMonitor(scope, monitorId);
  if (!monitor) throw new NotFoundError("Monitor");

  const jobBoss = boss ?? getJobBoss();

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
