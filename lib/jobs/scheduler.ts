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
  const due = await prisma.monitor.findMany({
    where: {
      enabled: true,
      nextRunAt: { lte: new Date() },
      website: { verifyStatus: "VERIFIED", deletedAt: null },
    },
    select: { id: true, organizationId: true, websiteId: true, type: true, frequencyMinutes: true },
    take: 100,
  });
  for (const monitor of due) {
    await boss.send(
      MONITOR_CHECK_JOB,
      {
        organizationId: monitor.organizationId,
        websiteId: monitor.websiteId,
        monitorId: monitor.id,
        type: monitor.type,
      } satisfies MonitorCheckJob,
      {
        retryLimit: JOB_RETRY_LIMIT,
        retryDelay: JOB_RETRY_DELAY_SECONDS,
        retryBackoff: true,
        expireInSeconds: JOB_EXPIRE_SECONDS,
        singletonKey: `monitor:${monitor.id}`,
        singletonSeconds: Math.max(1, monitor.frequencyMinutes * 60),
      },
    );
    await prisma.monitor.update({
      where: { id: monitor.id },
      data: { nextRunAt: new Date(Date.now() + monitor.frequencyMinutes * 60_000) },
    });
  }
  return due.length;
}
