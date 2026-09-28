import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { PgBoss } from "pg-boss";
import { getPrisma } from "@/db/client";
import { withGucContext } from "@/db/tenant";
import { collectDomainExpiry } from "@/lib/domain-expiry/collector";
import { expiryThreshold, type ExpiryObservation } from "@/lib/domain-expiry/records";
import { DEFAULT_EXPIRY_THRESHOLDS } from "@/lib/domain-expiry/config";
import { NOTIFICATION_JOB, type NotificationEvent } from "@/lib/notifications";

export async function persistDomainExpiry(
  tx: Prisma.TransactionClient,
  boss: PgBoss,
  monitorId: string,
  observation: ExpiryObservation,
  now = new Date(),
) {
  await tx.$executeRaw`SELECT id FROM monitoring_checks WHERE id = ${monitorId} FOR UPDATE`;
  const monitor = await tx.monitor.findUnique({
    where: { id: monitorId },
    include: { website: true },
  });
  if (
    !monitor?.enabled ||
    monitor.type !== "DOMAIN_EXPIRY" ||
    monitor.website.verifyStatus !== "VERIFIED"
  )
    return;
  const config = monitor.config as { thresholds?: number[]; lastSuccessful?: object };
  const thresholds = config.thresholds ?? DEFAULT_EXPIRY_THRESHOLDS;
  const threshold =
    observation.state === "KNOWN" ? expiryThreshold(observation.expiresAt, thresholds, now) : null;
  const status = observation.state === "UNKNOWN" ? "ERROR" : threshold === null ? "UP" : "DOWN";
  const latest = { ...observation, checkedAt: now.toISOString(), thresholdDays: threshold };
  await tx.monitor.update({
    where: { id: monitorId },
    data: {
      config: {
        ...config,
        expiry: latest,
        ...(observation.state === "KNOWN"
          ? { lastSuccessful: { ...observation, checkedAt: now.toISOString() } }
          : {}),
      } as Prisma.InputJsonValue,
      lastRunAt: now,
      nextRunAt: new Date(now.getTime() + monitor.frequencyMinutes * 60000),
      consecutiveFailures: status === "UP" ? 0 : { increment: 1 },
    },
  });
  await tx.monitoringResult.create({
    data: {
      organizationId: monitor.organizationId,
      websiteId: monitor.websiteId,
      monitorId,
      checkedAt: now,
      status,
      details: latest,
      ...(observation.state === "UNKNOWN" ? { errorMessage: observation.reason } : {}),
    },
  });
  await tx.website.update({ where: { id: monitor.websiteId }, data: { lastCheckedAt: now } });
  if (observation.state === "UNKNOWN") return; // Never recover an incident using unknown evidence.
  const domainKey = `${monitor.organizationId}:${observation.domain}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${domainKey}, 0))`;
  const prefix = `domain-expiry:${createHash("sha256").update(domainKey).digest("hex")}:`;
  const fingerprint = `${prefix}${observation.expiresAt}:${threshold}`;
  const candidates = await tx.issue.findMany({
    where: {
      organizationId: monitor.organizationId,
      ruleId: "monitor.domain_expiry",
      fingerprint: { startsWith: prefix, not: fingerprint },
      status: { notIn: ["RESOLVED", "IGNORED"] },
    },
    select: { id: true, status: true, technicalEvidence: true },
  });
  // A sibling monitor with a different policy must not clear a more urgent warning.
  const previous = candidates.filter((issue) => {
    const evidence = issue.technicalEvidence as { expiresAt?: string; thresholdDays?: number };
    return (
      evidence.expiresAt !== observation.expiresAt ||
      (threshold !== null &&
        typeof evidence.thresholdDays === "number" &&
        evidence.thresholdDays > threshold)
    );
  });
  if (previous.length) {
    await tx.issue.updateMany({
      where: { id: { in: previous.map((issue) => issue.id) } },
      data: { status: "RESOLVED", resolvedAt: now, resolvedBy: "SYSTEM" },
    });
    await tx.issueActivity.createMany({
      data: previous.map((issue) => ({
        organizationId: monitor.organizationId,
        issueId: issue.id,
        action: "RESOLVED",
        fromStatus: issue.status,
        toStatus: "RESOLVED",
        metadata: { source: "domain_expiry", reason: "deadline_or_threshold_changed" },
      })),
    });
  }
  if (threshold === null) return;
  const title =
    threshold === 0
      ? `Domain expired: ${observation.domain}`
      : `Domain expires within ${threshold} days: ${observation.domain}`;
  const summary = `Registry expiry: ${observation.expiresAt}. Confirm renewal with your registrar. Registry expiry can differ from a registrar billing deadline.`;
  const issue = await tx.issue.upsert({
    where: { fingerprint },
    create: {
      fingerprint,
      organizationId: monitor.organizationId,
      websiteId: monitor.websiteId,
      monitorId,
      ruleId: "monitor.domain_expiry",
      severity: threshold <= 7 ? "HIGH" : "MEDIUM",
      title,
      summary,
      technicalEvidence: latest,
      businessImpact: "Registration expiry can interrupt website and email services.",
    },
    update: { lastSeenAt: now, technicalEvidence: latest },
  });
  const claimed = await tx.domainExpiryAlert.createMany({
    data: {
      organizationId: monitor.organizationId,
      domain: observation.domain,
      expiresAt: new Date(observation.expiresAt),
      thresholdDays: threshold,
    },
    skipDuplicates: true,
  });
  if (!claimed.count) return;
  const members = await tx.organizationMember.findMany({
    where: {
      organizationId: monitor.organizationId,
      status: "ACTIVE",
      role: { in: ["OWNER", "ADMIN"] },
    },
    select: { userId: true },
  });
  const preferences = await tx.notificationPreference.findMany({
    where: { organizationId: monitor.organizationId, eventType: "ISSUE" },
  });
  for (const member of members) {
    for (const channel of ["IN_APP", "EMAIL"] as const) {
      if (
        preferences.some((p) => p.userId === member.userId && p.channel === channel && !p.enabled)
      )
        continue;
      const event: NotificationEvent = {
        organizationId: monitor.organizationId,
        issueId: issue.id,
        recipientUserId: member.userId,
        title,
        body: summary,
        channel,
      };
      // Queue insertion shares the ledger transaction: a rollback cannot consume an alert.
      const id = await boss.send(NOTIFICATION_JOB, event, {
        retryLimit: 3,
        retryDelay: 30,
        retryBackoff: true,
        expireInSeconds: 300,
        db: {
          executeSql: async (sql, values = []) => ({
            rows: await tx.$queryRawUnsafe<unknown[]>(sql, ...values),
          }),
        },
      });
      if (!id) throw Error("Domain expiry notification could not be queued");
    }
  }
}

export async function runDomainExpiryCheck(
  boss: PgBoss,
  organizationId: string,
  monitorId: string,
  hostname: string,
) {
  const observation = await collectDomainExpiry(hostname);
  await boss.createQueue(NOTIFICATION_JOB);
  await withGucContext(
    { organizationId },
    (tx) => persistDomainExpiry(tx, boss, monitorId, observation),
    getPrisma(),
  );
}
