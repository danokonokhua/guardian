import "server-only";

import type { TenantScope } from "@/db/tenant";
import { withTenantTransaction } from "@/db/tenant";
import {
  DEFAULT_SLA_POLICY,
  slaPolicySchema,
  type SlaPolicy,
} from "@/services/organizations/settings";

export const ISSUE_SLA_MINUTES = {
  acknowledge: DEFAULT_SLA_POLICY.acknowledgeMinutes,
  resolve: DEFAULT_SLA_POLICY.resolveMinutes,
} as const;

export interface IssueAnalytics {
  meanTimeToAcknowledgeMinutes: number | null;
  meanTimeToResolveMinutes: number | null;
  sampleSizes: { acknowledged: number; resolved: number };
  sla: {
    acknowledgeMinutes: number;
    resolveMinutes: number;
    activeBreaches: number;
    acknowledgeBreaches: number;
    resolveBreaches: number;
  };
  policy: SlaPolicy;
  volumeTrend: Array<{ date: string; total: number; active: number; resolved: number }>;
}

function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / 60_000);
}

export function readIssueAnalytics(scope: TenantScope): Promise<IssueAnalytics> {
  return withTenantTransaction(scope, async (tx) => {
    const organization = await tx.organization.findUnique({
      where: { id: scope.organizationId },
      select: { settings: true },
    });
    const settings = organization?.settings;
    const stored =
      typeof settings === "object" && settings !== null && "sla" in settings
        ? (settings as { sla?: unknown }).sla
        : undefined;
    const parsedPolicy = slaPolicySchema.safeParse(stored);
    const policy: SlaPolicy = parsedPolicy.success ? parsedPolicy.data : { ...DEFAULT_SLA_POLICY };
    const issues = await tx.issue.findMany({
      where: { organizationId: scope.organizationId },
      orderBy: { firstSeenAt: "desc" },
      take: 1000,
      select: {
        firstSeenAt: true,
        status: true,
        activities: {
          where: { action: { in: ["ACKNOWLEDGED", "RESOLVED"] } },
          orderBy: { createdAt: "asc" },
          select: { action: true, createdAt: true },
        },
      },
    });
    const acknowledgeTimes: number[] = [];
    const resolveTimes: number[] = [];
    let acknowledgeBreaches = 0;
    let resolveBreaches = 0;
    const now = Date.now();
    for (const issue of issues) {
      const acknowledged = issue.activities.find((activity) => activity.action === "ACKNOWLEDGED");
      const resolved = issue.activities.find((activity) => activity.action === "RESOLVED");
      if (acknowledged) {
        const minutes = minutesBetween(issue.firstSeenAt, acknowledged.createdAt);
        acknowledgeTimes.push(minutes);
        if (minutes > policy.acknowledgeMinutes) acknowledgeBreaches += 1;
      } else if (issue.status !== "RESOLVED" && issue.status !== "IGNORED") {
        const minutes = minutesBetween(issue.firstSeenAt, new Date(now));
        if (minutes > policy.acknowledgeMinutes) acknowledgeBreaches += 1;
      }
      if (resolved) {
        const minutes = minutesBetween(issue.firstSeenAt, resolved.createdAt);
        resolveTimes.push(minutes);
        if (minutes > policy.resolveMinutes) resolveBreaches += 1;
      } else if (issue.status !== "RESOLVED" && issue.status !== "IGNORED") {
        const minutes = minutesBetween(issue.firstSeenAt, new Date(now));
        if (minutes > policy.resolveMinutes) resolveBreaches += 1;
      }
    }

    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - 13);
    const trend = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      return { date: key, total: 0, active: 0, resolved: 0 };
    });
    const trendByDate = new Map(trend.map((point) => [point.date, point]));
    for (const issue of issues) {
      const point = trendByDate.get(issue.firstSeenAt.toISOString().slice(0, 10));
      if (!point) continue;
      point.total += 1;
      if (issue.status === "RESOLVED") point.resolved += 1;
      else if (issue.status !== "IGNORED") point.active += 1;
    }
    const average = (values: number[]) =>
      values.length === 0
        ? null
        : Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
    return {
      meanTimeToAcknowledgeMinutes: average(acknowledgeTimes),
      meanTimeToResolveMinutes: average(resolveTimes),
      sampleSizes: { acknowledged: acknowledgeTimes.length, resolved: resolveTimes.length },
      sla: {
        acknowledgeMinutes: policy.acknowledgeMinutes,
        resolveMinutes: policy.resolveMinutes,
        activeBreaches: acknowledgeBreaches + resolveBreaches,
        acknowledgeBreaches,
        resolveBreaches,
      },
      volumeTrend: trend,
      policy,
    };
  });
}
