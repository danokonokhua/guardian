import type { PgBoss } from "pg-boss";
import { getPrisma } from "@/db/client";
import { syncAllCompetitors } from "./service";
import { logger } from "@/lib/logger";

export const COMPETITOR_SYNC_JOB = "competitor.sync";

export async function registerCompetitorSyncWorker(boss: PgBoss): Promise<void> {
  await boss.createQueue(COMPETITOR_SYNC_JOB, {
    retryLimit: 2,
    retryDelay: 60,
    expireInSeconds: 300,
  });

  await boss.work(COMPETITOR_SYNC_JOB, async ([job]) => {
    if (!job) return;
    const data = job.data as { organizationId?: string } | undefined;
    const organizationId = data?.organizationId;
    if (!organizationId) return;

    try {
      const result = await syncAllCompetitors(
        { organizationId, userId: "00000000-0000-4000-8000-000000000000", role: "OWNER" },
        { isSandbox: false },
      );
      logger.info("competitor_sync_completed", {
        organizationId,
        probedCount: result.probedCount,
      });
    } catch (error) {
      logger.error("competitor_sync_failed", { organizationId, error });
      throw error;
    }
  });
}

export async function scheduleDueCompetitorSync(boss: PgBoss): Promise<number> {
  const prisma = getPrisma();
  // Find organizations with active competitors
  const orgsWithCompetitors = await prisma.competitor.findMany({
    where: { status: "ACTIVE" },
    select: { organizationId: true },
    distinct: ["organizationId"],
  });

  let queued = 0;
  for (const org of orgsWithCompetitors) {
    await boss.send(
      COMPETITOR_SYNC_JOB,
      { organizationId: org.organizationId },
      {
        singletonKey: `competitor-sync:${org.organizationId}`,
        singletonSeconds: 3600 * 6, // at most once every 6 hours
      },
    );
    queued++;
  }

  return queued;
}

