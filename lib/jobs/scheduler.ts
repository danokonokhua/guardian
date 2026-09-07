import "server-only";

import type { PgBoss } from "pg-boss";
import { getJobBoss } from "@/lib/jobs/boss";
import {
  MONITOR_CHECK_JOB,
  JOB_RETRY_DELAY_SECONDS,
  JOB_RETRY_LIMIT,
  JOB_EXPIRE_SECONDS,
} from "@/lib/jobs/constants";
import { getPrisma } from "@/db/client";
import {
  claimMonitorDispatch,
  listDueMonitorDispatches,
  releaseMonitorDispatch,
} from "@/lib/jobs/dispatch";

export interface MonitorCheckJob {
  organizationId: string;
  websiteId: string;
  monitorId: string;
  type: string;
}

/** Enqueues due monitors; execution is intentionally handled by a later phase. */
export async function scheduleDueMonitors(boss: PgBoss = getJobBoss()): Promise<number> {
  await boss.createQueue(MONITOR_CHECK_JOB, {
    retryLimit: JOB_RETRY_LIMIT,
    retryDelay: JOB_RETRY_DELAY_SECONDS,
    retryBackoff: true,
    expireInSeconds: JOB_EXPIRE_SECONDS,
  });
  const prisma = getPrisma();
  const due = await listDueMonitorDispatches(prisma);
  for (const monitor of due) {
    const claimed = await claimMonitorDispatch(prisma, monitor.monitorId);
    if (!claimed) continue;
    try {
      await boss.send(
        MONITOR_CHECK_JOB,
        {
          organizationId: claimed.organizationId,
          websiteId: claimed.websiteId,
          monitorId: claimed.monitorId,
          type: claimed.type,
        } satisfies MonitorCheckJob,
        {
          retryLimit: JOB_RETRY_LIMIT,
          retryDelay: JOB_RETRY_DELAY_SECONDS,
          retryBackoff: true,
          expireInSeconds: JOB_EXPIRE_SECONDS,
          singletonKey: `monitor:${claimed.monitorId}`,
          singletonSeconds: Math.max(1, claimed.frequencyMinutes * 60),
        },
      );
    } catch (error) {
      await releaseMonitorDispatch(prisma, claimed.monitorId);
      throw error;
    }
  }
  return due.length;
}
