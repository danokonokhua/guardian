import "server-only";

import type { Prisma } from "@prisma/client";
import type { TenantScope } from "@/db/tenant";
import { withTenantTransaction } from "@/db/tenant";

export interface HealthOverview {
  summary: {
    monitors: number;
    up: number;
    down: number;
    error: number;
    pending: number;
    activeIssues: number;
    recoveredIssues: number;
  };
  recentResults: Array<{
    id: string;
    status: string;
    checkedAt: Date;
    responseTimeMs: number | null;
    httpStatusCode: number | null;
    monitorType: string;
    websiteId: string;
    websiteName: string;
  }>;
  issues: Array<{
    id: string;
    ruleId: string;
    title: string;
    summary: string;
    severity: string;
    status: string;
    firstSeenAt: Date;
    lastSeenAt: Date;
    resolvedAt: Date | null;
    websiteId: string;
    assignedToId: string | null;
    assignedTo: { id: string; email: string; name: string | null } | null;
    technicalEvidence: Prisma.JsonValue;
    activities: Array<{
      id: string;
      action: string;
      fromStatus: string | null;
      toStatus: string | null;
      createdAt: Date;
      actor: { id: string; email: string; name: string | null } | null;
      assignedTo: { id: string; email: string; name: string | null } | null;
    }>;
    websiteName: string;
  }>;
  responseHistory: Array<{
    checkedAt: Date;
    responseTimeMs: number;
    websiteName: string;
  }>;
}

export function readHealthOverview(scope: TenantScope): Promise<HealthOverview> {
  return withTenantTransaction(scope, async (tx) => {
    const [monitors, results, issues] = await Promise.all([
      tx.monitor.findMany({
        where: { organizationId: scope.organizationId, enabled: true },
        select: {
          id: true,
          results: { orderBy: { checkedAt: "desc" }, take: 1, select: { status: true } },
        },
      }),
      tx.monitoringResult.findMany({
        where: { organizationId: scope.organizationId },
        orderBy: { checkedAt: "desc" },
        take: 50,
        select: {
          id: true,
          status: true,
          checkedAt: true,
          responseTimeMs: true,
          httpStatusCode: true,
          monitor: { select: { type: true } },
          website: { select: { id: true, hostname: true, label: true } },
        },
      }),
      tx.issue.findMany({
        where: { organizationId: scope.organizationId },
        orderBy: { lastSeenAt: "desc" },
        take: 50,
        select: {
          id: true,
          ruleId: true,
          title: true,
          summary: true,
          severity: true,
          status: true,
          firstSeenAt: true,
          lastSeenAt: true,
          resolvedAt: true,
          websiteId: true,
          assignedToId: true,
          assignedTo: { select: { id: true, email: true, name: true } },
          technicalEvidence: true,
          activities: {
            orderBy: { createdAt: "desc" },
            take: 20,
            select: {
              id: true,
              action: true,
              fromStatus: true,
              toStatus: true,
              createdAt: true,
              actor: { select: { id: true, email: true, name: true } },
              assignedTo: { select: { id: true, email: true, name: true } },
            },
          },
          website: { select: { hostname: true, label: true } },
        },
      }),
    ]);

    const latestStatuses = monitors.map((monitor) => monitor.results[0]?.status);
    const activeStatuses = new Set(["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"]);
    return {
      summary: {
        monitors: monitors.length,
        up: latestStatuses.filter((status) => status === "UP").length,
        down: latestStatuses.filter((status) => status === "DOWN").length,
        error: latestStatuses.filter((status) => status === "ERROR").length,
        pending: latestStatuses.filter((status) => status === undefined).length,
        activeIssues: issues.filter((issue) => activeStatuses.has(issue.status)).length,
        recoveredIssues: issues.filter((issue) => issue.status === "RESOLVED").length,
      },
      recentResults: results.map((result) => ({
        id: result.id,
        status: result.status,
        checkedAt: result.checkedAt,
        responseTimeMs: result.responseTimeMs,
        httpStatusCode: result.httpStatusCode,
        monitorType: result.monitor.type,
        websiteId: result.website.id,
        websiteName: result.website.label || result.website.hostname,
      })),
      issues: issues.map((issue) => ({
        id: issue.id,
        ruleId: issue.ruleId,
        title: issue.title,
        summary: issue.summary,
        severity: issue.severity,
        status: issue.status,
        firstSeenAt: issue.firstSeenAt,
        lastSeenAt: issue.lastSeenAt,
        resolvedAt: issue.resolvedAt,
        websiteId: issue.websiteId,
        assignedToId: issue.assignedToId,
        assignedTo: issue.assignedTo,
        technicalEvidence: issue.technicalEvidence,
        activities: issue.activities,
        websiteName: issue.website.label || issue.website.hostname,
      })),
      responseHistory: results
        .filter(
          (result): result is typeof result & { responseTimeMs: number } =>
            result.responseTimeMs !== null,
        )
        .slice(0, 30)
        .reverse()
        .map((result) => ({
          checkedAt: result.checkedAt,
          responseTimeMs: result.responseTimeMs,
          websiteName: result.website.label || result.website.hostname,
        })),
    };
  });
}
