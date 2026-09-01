import type { PgBoss } from "pg-boss";
import { getPrisma } from "@/db/client";
import { withGucContext } from "@/db/tenant";
import { MONITOR_CHECK_JOB } from "@/lib/jobs/constants";
import type { MonitorCheckJob } from "@/lib/jobs/scheduler";
import { recordFindingScoped, resolveFindingScoped, issueFingerprint } from "@/lib/issue-engine";

/** Registers the first execution handler: a bounded HTTP uptime check. */
export async function registerMonitorCheckWorker(boss: PgBoss): Promise<void> {
  await boss.createQueue(MONITOR_CHECK_JOB);
  await boss.work<MonitorCheckJob>(MONITOR_CHECK_JOB, async ([job]) => {
    if (!job) return;
    const prisma = getPrisma();
    const target = await withGucContext(
      { organizationId: job.data.organizationId },
      async (tx) => {
        const monitor = await tx.monitor.findFirst({
          where: { id: job.data.monitorId, organizationId: job.data.organizationId },
          select: { id: true, enabled: true, organizationId: true, websiteId: true },
        });
        if (!monitor || !monitor.enabled || monitor.websiteId !== job.data.websiteId) return null;
        const website = await tx.website.findFirst({
          where: { id: job.data.websiteId, organizationId: job.data.organizationId },
          select: { id: true, normalizedUrl: true, verifyStatus: true },
        });
        return website?.verifyStatus === "VERIFIED" ? { monitor, website } : null;
      },
      prisma,
    );
    if (!target) return;
    const startedAt = Date.now();
    let ok = false;
    let httpStatusCode: number | undefined;
    let errorMessage: string | undefined;
    try {
      const response = await fetch(target.website.normalizedUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(10_000),
      });
      ok = response.ok;
      httpStatusCode = response.status;
    } catch (error: unknown) {
      ok = false;
      errorMessage =
        error instanceof Error ? error.message.slice(0, 500) : "Monitor request failed";
    }
    const responseTimeMs = Date.now() - startedAt;
    const status = ok ? "UP" : errorMessage === undefined ? "DOWN" : "ERROR";
    await withGucContext(
      { organizationId: job.data.organizationId },
      async (tx) => {
        await tx.monitoringResult.create({
          data: {
            organizationId: job.data.organizationId,
            monitorId: target.monitor.id,
            websiteId: target.website.id,
            status,
            responseTimeMs,
            httpStatusCode,
            errorMessage,
            details: { checkType: job.data.type },
          },
        });
        await tx.monitor.update({
          where: { id: target.monitor.id },
          data: { lastRunAt: new Date(), consecutiveFailures: ok ? 0 : { increment: 1 } },
        });
        await tx.website.update({
          where: { id: target.website.id },
          data: { lastCheckedAt: new Date() },
        });
      },
      prisma,
    );
    const finding = {
      organizationId: job.data.organizationId,
      websiteId: target.website.id,
      monitorId: target.monitor.id,
      ruleId: "monitor.uptime",
      subjectKey: target.website.id,
      severity: "HIGH" as const,
      title: "Website is unreachable",
      summary: errorMessage ?? `Website returned HTTP ${httpStatusCode ?? "an error"}.`,
      technicalEvidence: { status, responseTimeMs, httpStatusCode, errorMessage },
    };
    if (ok) {
      await resolveFindingScoped(
        { organizationId: job.data.organizationId },
        issueFingerprint(finding),
        prisma,
      );
    } else {
      await recordFindingScoped({ organizationId: job.data.organizationId }, finding, prisma);
    }
  });
}
