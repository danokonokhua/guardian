import type { PgBoss } from "pg-boss";

import {
  JOB_EXPIRE_SECONDS,
  JOB_RETRY_DELAY_SECONDS,
  JOB_RETRY_LIMIT,
  SYSTEM_PING_JOB,
  SYSTEM_PING_SINGLETON_KEY,
} from "@/lib/jobs/constants";
import { getJobBoss } from "@/lib/jobs/boss";
import { logger } from "@/lib/logger";

export interface SystemPingPayload {
  readonly enqueuedAt: string;
  readonly source: "cron";
}

export interface EnqueueSystemPingResult {
  readonly jobId: string | null;
  readonly deduplicated: boolean;
}

/**
 * Enqueues the foundation job. pg-boss's singleton options provide an atomic guard
 * for created/retry/active states, so concurrent cron requests cannot create
 * duplicate in-flight system.ping jobs.
 */
export async function enqueueSystemPing(
  boss: PgBoss = getJobBoss(),
): Promise<EnqueueSystemPingResult> {
  const jobId = await boss.send(
    SYSTEM_PING_JOB,
    { enqueuedAt: new Date().toISOString(), source: "cron" } satisfies SystemPingPayload,
    {
      retryLimit: JOB_RETRY_LIMIT,
      retryDelay: JOB_RETRY_DELAY_SECONDS,
      retryBackoff: true,
      expireInSeconds: JOB_EXPIRE_SECONDS,
      singletonKey: SYSTEM_PING_SINGLETON_KEY,
      singletonSeconds: JOB_EXPIRE_SECONDS,
    },
  );

  if (jobId === null) {
    logger.info("system_ping_deduplicated", { job: SYSTEM_PING_JOB });
    return { jobId: null, deduplicated: true };
  }

  logger.info("system_ping_enqueued", { job: SYSTEM_PING_JOB, jobId });
  return { jobId, deduplicated: false };
}

/** Registers the only job handler in this phase. */
export async function registerSystemPingWorker(boss: PgBoss = getJobBoss()): Promise<void> {
  await boss.createQueue(SYSTEM_PING_JOB, {
    retryLimit: JOB_RETRY_LIMIT,
    retryDelay: JOB_RETRY_DELAY_SECONDS,
    retryBackoff: true,
    expireInSeconds: JOB_EXPIRE_SECONDS,
  });
  await boss.work(SYSTEM_PING_JOB, async ([job]) => {
    if (!job) {
      return { ok: false, completedAt: new Date().toISOString() };
    }
    logger.info("system_ping_completed", {
      job: SYSTEM_PING_JOB,
      jobId: job.id,
    });

    return { ok: true, completedAt: new Date().toISOString() };
  });
}
