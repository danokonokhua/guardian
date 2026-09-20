import "server-only";

import type { Prisma } from "@prisma/client";
import type { PrismaTransactionHost, TenantScope } from "@/db/tenant";
import { withGucContext, withTenantTransaction } from "@/db/tenant";
import { calculateDigitalHealthScore, type DigitalHealthScore } from "@/lib/health-score";
import {
  generateGroundedRecommendations,
  type GroundedRecommendation,
} from "@/lib/recommendations";

export interface HealthOverview {
  healthScore: DigitalHealthScore;
  recommendations: GroundedRecommendation[];
  healthScoreHistory: Array<{
    id: string;
    score: number | null;
    state: string;
    coverageWeight: number;
    sourceVersion: string;
    calculatedAt: Date;
  }>;
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
    businessImpact: string | null;
    impactConfidence: number | null;
    metadata: Prisma.JsonValue;
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
    const [monitors, results, issues, scoreHistory] = await Promise.all([
      tx.monitor.findMany({
        where: { organizationId: scope.organizationId, enabled: true },
        select: {
          id: true,
          type: true,
          results: {
            orderBy: { checkedAt: "desc" },
            take: 1,
            select: { id: true, status: true, checkedAt: true },
          },
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
          businessImpact: true,
          impactConfidence: true,
          metadata: true,
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
      tx.healthScore.findMany({
        where: { organizationId: scope.organizationId },
        orderBy: { calculatedAt: "desc" },
        take: 30,
        select: {
          id: true,
          score: true,
          state: true,
          coverageWeight: true,
          sourceVersion: true,
          calculatedAt: true,
        },
      }),
    ]);

    const latestStatuses = monitors.map((monitor) => monitor.results[0]?.status);
    const activeStatuses = new Set(["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"]);
    const healthScore = calculateDigitalHealthScore(
      monitors.map((monitor) => ({
        id: monitor.results[0]?.id ?? `pending:${monitor.id}`,
        monitorId: monitor.id,
        monitorType: monitor.type,
        status: monitor.results[0]?.status,
        checkedAt: monitor.results[0]?.checkedAt,
      })),
      issues.map((issue) => ({
        id: issue.id,
        ruleId: issue.ruleId,
        severity: issue.severity,
        status: issue.status,
        title: issue.title,
        summary: issue.summary,
        businessImpact: issue.businessImpact,
        lastSeenAt: issue.lastSeenAt,
      })),
    );
    const recommendations = generateGroundedRecommendations(
      healthScore,
      issues.map((issue) => ({
        id: issue.id,
        ruleId: issue.ruleId,
        title: issue.title,
        summary: issue.summary,
        severity: issue.severity,
        status: issue.status,
        lastSeenAt: issue.lastSeenAt,
        businessImpact: issue.businessImpact,
        impactConfidence: issue.impactConfidence,
        metadata: issue.metadata,
      })),
    );
    return {
      healthScore,
      recommendations,
      healthScoreHistory: scoreHistory,
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
        businessImpact: issue.businessImpact,
        impactConfidence: issue.impactConfidence,
        metadata: issue.metadata,
        activities: issue.activities,
        websiteName: issue.website.label || issue.website.hostname,
      })),
      responseHistory: results
        .filter(
          (result): result is typeof result & { responseTimeMs: number } =>
            result.monitor.type === "UPTIME" && result.responseTimeMs !== null,
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

/**
 * Captures one immutable score snapshot after a monitor outcome has been
 * recorded.  The query and nested insert share the same tenant-local GUC
 * transaction, so a worker can never calculate or persist another
 * organization's score.
 */
export function captureHealthScoreSnapshot(
  scope: Pick<TenantScope, "organizationId">,
  client?: PrismaTransactionHost,
): Promise<DigitalHealthScore> {
  return withGucContext(
    { organizationId: scope.organizationId },
    async (tx) => {
      const [monitors, issues] = await Promise.all([
        tx.monitor.findMany({
          where: { organizationId: scope.organizationId, enabled: true },
          select: {
            id: true,
            type: true,
            results: {
              orderBy: { checkedAt: "desc" },
              take: 1,
              select: { id: true, status: true, checkedAt: true },
            },
          },
        }),
        tx.issue.findMany({
          where: {
            organizationId: scope.organizationId,
            status: { in: ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"] },
          },
          orderBy: { lastSeenAt: "desc" },
          take: 100,
          select: {
            id: true,
            ruleId: true,
            severity: true,
            status: true,
            title: true,
            summary: true,
            businessImpact: true,
            lastSeenAt: true,
          },
        }),
      ]);
      const calculatedAt = new Date();
      const score = calculateDigitalHealthScore(
        monitors.map((monitor) => ({
          id: monitor.results[0]?.id ?? `pending:${monitor.id}`,
          monitorId: monitor.id,
          monitorType: monitor.type,
          status: monitor.results[0]?.status,
          checkedAt: monitor.results[0]?.checkedAt,
        })),
        issues,
        calculatedAt,
      );
      await tx.healthScore.create({
        data: {
          organizationId: scope.organizationId,
          score: score.score,
          state: score.state,
          coverageWeight: score.coverageWeight,
          sourceVersion: score.sourceVersion,
          calculatedAt,
          components: {
            create: score.components.map((component) => ({
              organization: { connect: { id: scope.organizationId } },
              category: component.category,
              weight: component.weight,
              score: component.score,
              state: component.state,
              monitorCount: component.evidence.monitorCount,
              resultCount: component.evidence.resultCount,
              upCount: component.evidence.upCount,
              downCount: component.evidence.downCount,
              errorCount: component.evidence.errorCount,
              explanation: component.explanation,
              evidence: component.evidence as unknown as Prisma.InputJsonValue,
              calculatedAt,
            })),
          },
        },
      });
      return score;
    },
    client,
  );
}
