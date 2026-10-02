import "server-only";
import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/db/client";
import { withGucContext } from "@/db/tenant";
import { issueFingerprint, recordFindingWithClient } from "@/lib/issue-engine";
import { collectEmailHealth } from "@/lib/email-health/collector";
import {
  EMAIL_PROTOCOLS,
  type EmailHealthConfig,
  type EmailHealthSnapshot,
  type PolicyEvidence,
} from "@/lib/email-health/types";

function policyKey(e: PolicyEvidence) {
  return JSON.stringify({
    state: e.state,
    source: e.source,
    records: [...e.records].sort(),
    policy: e.policy ?? "",
    details: e.details ?? [],
  });
}
export async function persistEmailHealth(
  tx: Prisma.TransactionClient,
  monitorId: string,
  snapshot: EmailHealthSnapshot,
) {
  await tx.$executeRaw`SELECT id FROM monitoring_checks WHERE id = ${monitorId} FOR UPDATE`;
  const monitor = await tx.monitor.findUnique({
    where: { id: monitorId },
    include: { website: true },
  });
  if (
    !monitor?.enabled ||
    monitor.type !== "EMAIL_HEALTH" ||
    monitor.website.verifyStatus !== "VERIFIED"
  )
    return;
  const config = monitor.config as EmailHealthConfig;
  // A scope change during collection invalidates this in-flight observation.
  const now = new Date(snapshot.checkedAt);
  if (monitor.lastRunAt && monitor.lastRunAt > now) return;
  const known = { ...config.emailLastKnown };
  const changes: string[] = [];
  for (const protocol of EMAIL_PROTOCOLS) {
    const check = snapshot.checks[protocol];
    if (check.state === "UNKNOWN") continue;
    if (known[protocol] && policyKey(known[protocol]!) !== policyKey(check)) changes.push(protocol);
    known[protocol] = { ...check, checkedAt: snapshot.checkedAt };
    const ruleId = `monitor.email_${protocol.toLowerCase()}`;
    const finding = {
      organizationId: monitor.organizationId,
      websiteId: monitor.websiteId,
      monitorId,
      ruleId,
      subjectKey: snapshot.domain,
      severity: "MEDIUM" as const,
      title: `${protocol.replace("_", "-")} configuration: ${check.state.toLowerCase()}`,
      summary: check.summary,
      technicalEvidence: check as unknown as Prisma.InputJsonValue,
      businessImpact:
        "Email authentication or transport policy gaps can increase spoofing or delivery risks.",
      recommendedAction:
        "Review the published policy with your email administrator. Guardian does not change DNS or email configuration.",
    };
    if (check.state !== "HEALTHY") {
      const issue = await recordFindingWithClient(finding, tx);
      await tx.issue.update({ where: { id: issue.id }, data: { title: finding.title } });
    } else {
      const issue = await tx.issue.findUnique({
        where: { fingerprint: issueFingerprint(finding) },
      });
      if (issue && !["RESOLVED", "IGNORED"].includes(issue.status)) {
        await tx.issue.update({
          where: { id: issue.id },
          data: { status: "RESOLVED", resolvedAt: now, resolvedBy: "SYSTEM" },
        });
        await tx.issueActivity.create({
          data: {
            organizationId: monitor.organizationId,
            issueId: issue.id,
            action: "RESOLVED",
            fromStatus: issue.status,
            toStatus: "RESOLVED",
            metadata: { source: "email_health" },
          },
        });
      }
    }
  }
  const checks = Object.values(snapshot.checks);
  const status = checks.some((c) => ["MISSING", "INVALID", "WEAK"].includes(c.state))
    ? "DOWN"
    : checks.some((c) => c.state === "UNKNOWN")
      ? "ERROR"
      : "UP";
  await tx.monitor.update({
    where: { id: monitorId },
    data: {
      config: {
        ...config,
        emailHealth: snapshot,
        emailLastKnown: known,
        emailChanges: changes,
      } as unknown as Prisma.InputJsonValue,
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
      status,
      checkedAt: now,
      details: { ...snapshot, changes } as unknown as Prisma.InputJsonValue,
    },
  });
  await tx.website.update({ where: { id: monitor.websiteId }, data: { lastCheckedAt: now } });
}

export async function runEmailHealthCheck(
  organizationId: string,
  monitorId: string,
  hostname: string,
  config: unknown,
) {
  const scope = (config as EmailHealthConfig).domainScope ?? "REGISTERED";
  const snapshot = await collectEmailHealth(hostname, scope);
  await withGucContext(
    { organizationId },
    async (tx) => {
      await tx.$executeRaw`SELECT id FROM monitoring_checks WHERE id = ${monitorId} FOR UPDATE`;
      const current = await tx.monitor.findUnique({
        where: { id: monitorId },
        select: { config: true },
      });
      if (current && ((current.config as EmailHealthConfig).domainScope ?? "REGISTERED") === scope)
        await persistEmailHealth(tx, monitorId, snapshot);
    },
    getPrisma(),
  );
}
