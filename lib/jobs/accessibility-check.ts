import "server-only";
import type { Prisma } from "@prisma/client";
import { withGucContext } from "@/db/tenant";
import { issueFingerprint, recordFindingWithClient } from "@/lib/issue-engine";
import { collectAccessibility } from "@/lib/accessibility/collector";
import {
  ACCESSIBILITY_RULES,
  type AccessibilityConfig,
  type AccessibilityRule,
  type AccessibilitySnapshot,
} from "@/lib/accessibility/types";

export async function persistAccessibility(
  tx: Prisma.TransactionClient,
  monitorId: string,
  url: string,
  snapshot: AccessibilitySnapshot,
) {
  await tx.$executeRaw`SELECT id FROM monitoring_checks WHERE id = ${monitorId} FOR UPDATE`;
  const monitor = await tx.monitor.findUnique({
    where: { id: monitorId },
    include: { website: true },
  });
  if (
    !monitor?.enabled ||
    monitor.type !== "ACCESSIBILITY" ||
    monitor.website.verifyStatus !== "VERIFIED" ||
    monitor.website.normalizedUrl !== url
  )
    return;
  const now = new Date(snapshot.checkedAt);
  if (monitor.lastRunAt && monitor.lastRunAt >= now) return;
  const config = monitor.config as AccessibilityConfig;
  if (snapshot.state === "CHECKED")
    for (const rule of Object.keys(ACCESSIBILITY_RULES) as AccessibilityRule[]) {
      const definition = ACCESSIBILITY_RULES[rule];
      const evidence = snapshot.findings.find((f) => f.rule === rule);
      const finding = {
        organizationId: monitor.organizationId,
        websiteId: monitor.websiteId,
        monitorId,
        ruleId: `monitor.accessibility.${rule}`,
        subjectKey: snapshot.page,
        severity: definition.severity,
        title: definition.title,
        summary: `${evidence?.count ?? 0} potential ${rule} finding(s) in the server-delivered HTML. Confirm in the rendered page.`,
        technicalEvidence: {
          page: snapshot.page,
          tool: snapshot.tool,
          scope: snapshot.scope,
          checkedAt: snapshot.checkedAt,
          ...evidence,
        } as Prisma.InputJsonValue,
        businessImpact:
          "Accessibility barriers may prevent visitors using assistive technology from understanding or operating the page.",
        recommendedAction: definition.fix,
      };
      if (evidence) await recordFindingWithClient(finding, tx);
      else {
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
              metadata: { source: "accessibility_html" },
            },
          });
        }
      }
    }
  const status = snapshot.state === "UNKNOWN" ? "ERROR" : snapshot.findings.length ? "DOWN" : "UP";
  await tx.monitor.update({
    where: { id: monitorId },
    data: {
      config: {
        ...config,
        accessibility: snapshot,
        ...(snapshot.state === "CHECKED" ? { accessibilityLastKnown: snapshot } : {}),
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
      details: snapshot as unknown as Prisma.InputJsonValue,
    },
  });
  await tx.website.update({ where: { id: monitor.websiteId }, data: { lastCheckedAt: now } });
}
export async function runAccessibilityCheck(
  organizationId: string,
  monitorId: string,
  url: string,
) {
  const snapshot = await collectAccessibility(url);
  await withGucContext({ organizationId }, (tx) =>
    persistAccessibility(tx, monitorId, url, snapshot),
  );
}
