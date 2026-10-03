import "server-only";

import type { PgBoss } from "pg-boss";
import { getJobBoss } from "@/lib/jobs/boss";
import {
  RETENTION_PRUNE_JOB,
  RETENTION_PRUNE_SINGLETON_KEY,
  JOB_RETRY_LIMIT,
  JOB_RETRY_DELAY_SECONDS,
} from "@/lib/jobs/constants";
import { pruneAllOrganizations, pruneSystemMaintenance } from "@/services/retention/pruner";
import { logger } from "@/lib/logger";

export interface RetentionPruneJobPayload {
  triggeredBy?: string;
  dryRun?: boolean;
}

/** Enqueues the retention pruning job with singleton throttling. */
export async function enqueueRetentionPruneJob(
  boss: PgBoss = getJobBoss(),
  payload: RetentionPruneJobPayload = {},
  singletonSeconds = 3600 * 24, // Once per 24 hours by default
): Promise<string | null> {
  await boss.createQueue(RETENTION_PRUNE_JOB, {
    retryLimit: JOB_RETRY_LIMIT,
    retryDelay: JOB_RETRY_DELAY_SECONDS,
    retryBackoff: true,
  });

  const jobId = await boss.send(RETENTION_PRUNE_JOB, payload, {
    retryLimit: JOB_RETRY_LIMIT,
    retryDelay: JOB_RETRY_DELAY_SECONDS,
    retryBackoff: true,
    singletonKey: RETENTION_PRUNE_SINGLETON_KEY,
    singletonSeconds,
  });

  if (jobId) {
    logger.info("retention_prune_job_enqueued", { jobId, triggeredBy: payload.triggeredBy });
  } else {
    logger.info("retention_prune_job_throttled", { reason: "singleton_active" });
  }

  return jobId;
}

/** Registers the background worker handling historical retention pruning. */
export async function registerRetentionPruneWorker(boss: PgBoss = getJobBoss()): Promise<void> {
  await boss.createQueue(RETENTION_PRUNE_JOB, {
    retryLimit: JOB_RETRY_LIMIT,
    retryDelay: JOB_RETRY_DELAY_SECONDS,
    retryBackoff: true,
  });

  await boss.work<RetentionPruneJobPayload>(RETENTION_PRUNE_JOB, async ([job]) => {
    if (!job) return;

    logger.info("retention_prune_job_started", {
      jobId: job.id,
      triggeredBy: job.data?.triggeredBy,
      dryRun: Boolean(job.data?.dryRun),
    });

    try {
      const orgResults = await pruneAllOrganizations({ dryRun: job.data?.dryRun });
      const sysResults = await pruneSystemMaintenance();

      logger.info("retention_prune_job_finished", {
        jobId: job.id,
        organizationsPruned: orgResults.organizationsPruned,
        telemetryPruned: orgResults.totalMonitoringResultsPruned,
        scoresPruned: orgResults.totalHealthScoresPruned,
        issuesPruned: orgResults.totalResolvedIssuesPruned,
        notificationsPruned: orgResults.totalNotificationsPruned,
        deliveriesPruned: orgResults.totalExternalDeliveriesPruned,
        expiredSessionsPruned: sysResults.expiredSessionsPruned,
        durationMs: orgResults.durationMs + sysResults.durationMs,
      });
    } catch (error) {
      logger.error("retention_prune_job_failed", {
        jobId: job.id,
        error: String(error),
      });
      throw error;
    }
  });

  logger.info("retention_prune_worker_registered");
}
