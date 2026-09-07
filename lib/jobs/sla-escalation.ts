import "server-only";

import type { PgBoss } from "pg-boss";
import { getJobBoss } from "@/lib/jobs/boss";
import { getPrisma } from "@/db/client";
import {
  claimSlaDispatch,
  deleteSlaDispatch,
  listDueSlaDispatches,
  releaseSlaDispatch,
} from "@/lib/jobs/dispatch";
import { enqueueNotification } from "@/lib/notifications";
import { enqueueSlaEscalations } from "@/services/issues/escalation";
import {
  JOB_EXPIRE_SECONDS,
  JOB_RETRY_DELAY_SECONDS,
  JOB_RETRY_LIMIT,
  SLA_ESCALATION_JOB,
} from "@/lib/jobs/constants";
import { logger } from "@/lib/logger";

export interface SlaEscalationJob {
  organizationId: string;
}

const SYSTEM_USER_ID = "00000000-0000-4000-8000-000000000000";

export async function enqueueSlaEscalation(
  organizationId: string,
  boss: PgBoss = getJobBoss(),
): Promise<string | null> {
  await boss.createQueue(SLA_ESCALATION_JOB, {
    retryLimit: JOB_RETRY_LIMIT,
    retryDelay: JOB_RETRY_DELAY_SECONDS,
    retryBackoff: true,
    expireInSeconds: JOB_EXPIRE_SECONDS,
  });
  return boss.send(SLA_ESCALATION_JOB, { organizationId } satisfies SlaEscalationJob, {
    retryLimit: JOB_RETRY_LIMIT,
    retryDelay: JOB_RETRY_DELAY_SECONDS,
    retryBackoff: true,
    expireInSeconds: JOB_EXPIRE_SECONDS,
    singletonKey: `sla-escalation:${organizationId}`,
    singletonSeconds: JOB_EXPIRE_SECONDS,
  });
}

/** Queues due tenant-bound escalation jobs from the system dispatch registry. */
export async function scheduleDueSlaEscalations(boss: PgBoss = getJobBoss()): Promise<number> {
  const prisma = getPrisma();
  const organizations = await listDueSlaDispatches(prisma);
  let queued = 0;
  for (const organization of organizations) {
    const claimed = await claimSlaDispatch(prisma, organization.organizationId);
    if (!claimed) continue;
    try {
      if ((await enqueueSlaEscalation(claimed.organizationId, boss)) !== null) queued += 1;
    } catch (error) {
      await releaseSlaDispatch(prisma, claimed.organizationId);
      throw error;
    }
  }
  return queued;
}

export async function registerSlaEscalationWorker(boss: PgBoss = getJobBoss()): Promise<void> {
  await boss.createQueue(SLA_ESCALATION_JOB, {
    retryLimit: JOB_RETRY_LIMIT,
    retryDelay: JOB_RETRY_DELAY_SECONDS,
    retryBackoff: true,
    expireInSeconds: JOB_EXPIRE_SECONDS,
  });
  await boss.work<SlaEscalationJob>(SLA_ESCALATION_JOB, async ([job]) => {
    if (!job) return;
    const result = await enqueueSlaEscalations(
      { organizationId: job.data.organizationId, userId: SYSTEM_USER_ID, role: "OWNER" },
      (event) => enqueueNotification(event, boss),
    );
    if (result.checkedIssues === 0) {
      await deleteSlaDispatch(getPrisma(), job.data.organizationId);
    }
    logger.info("sla_escalation_completed", {
      organizationId: job.data.organizationId,
      breachedIssues: result.breachedIssues,
      notificationsQueued: result.notificationsQueued,
    });
  });
}
