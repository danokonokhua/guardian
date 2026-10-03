import "server-only";

import { getPrisma } from "@/db/client";
import { getPlanLimits } from "@/config/billing-plans";
import { logger } from "@/lib/logger";
import type { PrismaClient } from "@prisma/client";

export interface PruningOptions {
  batchSize?: number;
  dryRun?: boolean;
  now?: Date;
  customRetentionDays?: number;
}

export interface TenantPruningResult {
  organizationId: string;
  plan: string;
  retentionDays: number;
  skipped: boolean;
  reason?: string;
  monitoringResultsPruned: number;
  healthScoresPruned: number;
  resolvedIssuesPruned: number;
  externalDeliveriesPruned: number;
  notificationsPruned: number;
  cutoffDate?: Date;
}

export interface GlobalPruningResult {
  totalOrganizations: number;
  organizationsPruned: number;
  organizationsSkipped: number;
  totalMonitoringResultsPruned: number;
  totalHealthScoresPruned: number;
  totalResolvedIssuesPruned: number;
  totalExternalDeliveriesPruned: number;
  totalNotificationsPruned: number;
  durationMs: number;
  tenantResults: TenantPruningResult[];
}

export interface SystemPruningResult {
  expiredSessionsPruned: number;
  expiredResetTokensPruned: number;
  staleLoginThrottlesPruned: number;
  durationMs: number;
}

const DEFAULT_BATCH_SIZE = 1000;
const FREE_TIER_GRACE_DAYS = 7;

/**
 * Resolves the effective history retention in days for a given plan tier.
 * Returns Infinity if retention is unlimited.
 */
export function getEffectiveRetentionDays(plan: string): number {
  try {
    const limits = getPlanLimits(plan);
    if (limits.historyDays === Infinity) {
      return Infinity;
    }
    if (limits.historyDays === 0) {
      return FREE_TIER_GRACE_DAYS;
    }
    return limits.historyDays;
  } catch {
    return FREE_TIER_GRACE_DAYS;
  }
}

/**
 * Prunes historical records for a single organization based on its plan limits.
 */
export async function pruneOrganizationHistory(
  organizationId: string,
  options: PruningOptions = {},
  client?: PrismaClient,
): Promise<TenantPruningResult> {
  const prisma = client ?? getPrisma();
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const now = options.now ?? new Date();

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      plan: true,
      subscription: {
        select: {
          plan: true,
          status: true,
        },
      },
    },
  });

  if (!org) {
    return {
      organizationId,
      plan: "UNKNOWN",
      retentionDays: 0,
      skipped: true,
      reason: "Organization not found",
      monitoringResultsPruned: 0,
      healthScoresPruned: 0,
      resolvedIssuesPruned: 0,
      externalDeliveriesPruned: 0,
      notificationsPruned: 0,
    };
  }

  const activePlan =
    org.subscription &&
    (org.subscription.status === "ACTIVE" || org.subscription.status === "TRIALING")
      ? org.subscription.plan
      : org.plan;

  const retentionDays = options.customRetentionDays ?? getEffectiveRetentionDays(activePlan);

  if (retentionDays === Infinity) {
    return {
      organizationId,
      plan: activePlan,
      retentionDays: Infinity,
      skipped: true,
      reason: "Plan provides unlimited history retention (Enterprise)",
      monitoringResultsPruned: 0,
      healthScoresPruned: 0,
      resolvedIssuesPruned: 0,
      externalDeliveriesPruned: 0,
      notificationsPruned: 0,
    };
  }

  const cutoffDate = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

  if (options.dryRun) {
    const [resultsCount, scoresCount, issuesCount, deliveriesCount, notificationsCount] =
      await Promise.all([
        prisma.monitoringResult.count({
          where: { organizationId, checkedAt: { lt: cutoffDate } },
        }),
        prisma.healthScore.count({
          where: { organizationId, calculatedAt: { lt: cutoffDate } },
        }),
        prisma.issue.count({
          where: {
            organizationId,
            status: { in: ["RESOLVED", "IGNORED"] },
            resolvedAt: { lt: cutoffDate },
          },
        }),
        prisma.externalDelivery.count({
          where: { organizationId, createdAt: { lt: cutoffDate } },
        }),
        prisma.inAppNotification.count({
          where: { organizationId, createdAt: { lt: cutoffDate } },
        }),
      ]);

    return {
      organizationId,
      plan: activePlan,
      retentionDays,
      skipped: false,
      cutoffDate,
      monitoringResultsPruned: resultsCount,
      healthScoresPruned: Math.max(0, scoresCount - 1),
      resolvedIssuesPruned: issuesCount,
      externalDeliveriesPruned: deliveriesCount,
      notificationsPruned: notificationsCount,
    };
  }

  // 1. Prune monitoring_results in bounded batches
  let monitoringResultsPruned = 0;
  while (true) {
    const stale = await prisma.monitoringResult.findMany({
      where: { organizationId, checkedAt: { lt: cutoffDate } },
      select: { id: true },
      take: batchSize,
    });
    if (stale.length === 0) break;
    const res = await prisma.monitoringResult.deleteMany({
      where: { id: { in: stale.map((r) => r.id) } },
    });
    monitoringResultsPruned += res.count;
    if (stale.length < batchSize) break;
  }

  // 2. Prune health_scores, preserving the latest score snapshot
  let healthScoresPruned = 0;
  const latestScore = await prisma.healthScore.findFirst({
    where: { organizationId },
    orderBy: { calculatedAt: "desc" },
    select: { id: true },
  });

  while (true) {
    const stale = await prisma.healthScore.findMany({
      where: {
        organizationId,
        calculatedAt: { lt: cutoffDate },
        ...(latestScore ? { id: { not: latestScore.id } } : {}),
      },
      select: { id: true },
      take: batchSize,
    });
    if (stale.length === 0) break;
    const res = await prisma.healthScore.deleteMany({
      where: { id: { in: stale.map((s) => s.id) } },
    });
    healthScoresPruned += res.count;
    if (stale.length < batchSize) break;
  }

  // 3. Prune resolved / ignored issues (never touch open or in-progress issues)
  let resolvedIssuesPruned = 0;
  while (true) {
    const stale = await prisma.issue.findMany({
      where: {
        organizationId,
        status: { in: ["RESOLVED", "IGNORED"] },
        resolvedAt: { lt: cutoffDate },
      },
      select: { id: true },
      take: batchSize,
    });
    if (stale.length === 0) break;
    const res = await prisma.issue.deleteMany({
      where: { id: { in: stale.map((i) => i.id) } },
    });
    resolvedIssuesPruned += res.count;
    if (stale.length < batchSize) break;
  }

  // 4. Prune external deliveries
  let externalDeliveriesPruned = 0;
  while (true) {
    const stale = await prisma.externalDelivery.findMany({
      where: { organizationId, createdAt: { lt: cutoffDate } },
      select: { id: true },
      take: batchSize,
    });
    if (stale.length === 0) break;
    const res = await prisma.externalDelivery.deleteMany({
      where: { id: { in: stale.map((d) => d.id) } },
    });
    externalDeliveriesPruned += res.count;
    if (stale.length < batchSize) break;
  }

  // 5. Prune in-app notifications
  let notificationsPruned = 0;
  while (true) {
    const stale = await prisma.inAppNotification.findMany({
      where: { organizationId, createdAt: { lt: cutoffDate } },
      select: { id: true },
      take: batchSize,
    });
    if (stale.length === 0) break;
    const res = await prisma.inAppNotification.deleteMany({
      where: { id: { in: stale.map((n) => n.id) } },
    });
    notificationsPruned += res.count;
    if (stale.length < batchSize) break;
  }

  logger.info("history_retention_tenant_pruned", {
    organizationId,
    plan: activePlan,
    retentionDays,
    cutoffDate: cutoffDate.toISOString(),
    monitoringResultsPruned,
    healthScoresPruned,
    resolvedIssuesPruned,
    externalDeliveriesPruned,
    notificationsPruned,
  });

  return {
    organizationId,
    plan: activePlan,
    retentionDays,
    skipped: false,
    cutoffDate,
    monitoringResultsPruned,
    healthScoresPruned,
    resolvedIssuesPruned,
    externalDeliveriesPruned,
    notificationsPruned,
  };
}

/**
 * Iterates through all organizations and enforces historical retention limits.
 */
export async function pruneAllOrganizations(
  options: PruningOptions = {},
  client?: PrismaClient,
): Promise<GlobalPruningResult> {
  const startTime = Date.now();
  const prisma = client ?? getPrisma();

  logger.info("history_retention_prune_started", { dryRun: Boolean(options.dryRun) });

  const organizations = await prisma.organization.findMany({
    select: { id: true },
  });

  const tenantResults: TenantPruningResult[] = [];
  let totalMonitoringResultsPruned = 0;
  let totalHealthScoresPruned = 0;
  let totalResolvedIssuesPruned = 0;
  let totalExternalDeliveriesPruned = 0;
  let totalNotificationsPruned = 0;
  let organizationsPruned = 0;
  let organizationsSkipped = 0;

  for (const org of organizations) {
    try {
      const result = await pruneOrganizationHistory(org.id, options, prisma);
      tenantResults.push(result);

      if (result.skipped) {
        organizationsSkipped++;
      } else {
        organizationsPruned++;
        totalMonitoringResultsPruned += result.monitoringResultsPruned;
        totalHealthScoresPruned += result.healthScoresPruned;
        totalResolvedIssuesPruned += result.resolvedIssuesPruned;
        totalExternalDeliveriesPruned += result.externalDeliveriesPruned;
        totalNotificationsPruned += result.notificationsPruned;
      }
    } catch (error) {
      logger.error("history_retention_tenant_error", {
        organizationId: org.id,
        error: String(error),
      });
      tenantResults.push({
        organizationId: org.id,
        plan: "ERROR",
        retentionDays: 0,
        skipped: true,
        reason: `Error: ${String(error)}`,
        monitoringResultsPruned: 0,
        healthScoresPruned: 0,
        resolvedIssuesPruned: 0,
        externalDeliveriesPruned: 0,
        notificationsPruned: 0,
      });
      organizationsSkipped++;
    }
  }

  const durationMs = Date.now() - startTime;

  logger.info("history_retention_prune_completed", {
    totalOrganizations: organizations.length,
    organizationsPruned,
    organizationsSkipped,
    totalMonitoringResultsPruned,
    totalHealthScoresPruned,
    totalResolvedIssuesPruned,
    totalExternalDeliveriesPruned,
    totalNotificationsPruned,
    durationMs,
  });

  return {
    totalOrganizations: organizations.length,
    organizationsPruned,
    organizationsSkipped,
    totalMonitoringResultsPruned,
    totalHealthScoresPruned,
    totalResolvedIssuesPruned,
    totalExternalDeliveriesPruned,
    totalNotificationsPruned,
    durationMs,
    tenantResults,
  };
}

/**
 * Prunes expired sessions, reset tokens, and old login throttle records.
 */
export async function pruneSystemMaintenance(
  options: { now?: Date; throttleHours?: number } = {},
  client?: PrismaClient,
): Promise<SystemPruningResult> {
  const startTime = Date.now();
  const prisma = client ?? getPrisma();
  const now = options.now ?? new Date();
  const throttleCutoff = new Date(
    now.getTime() - (options.throttleHours ?? 24) * 60 * 60 * 1000,
  );

  const [sessionsRes, tokensRes, throttlesRes] = await Promise.all([
    prisma.authSession.deleteMany({
      where: { expiresAt: { lt: now } },
    }),
    prisma.passwordResetToken.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }],
      },
    }),
    prisma.authLoginThrottle.deleteMany({
      where: {
        updatedAt: { lt: throttleCutoff },
        blockedUntil: null,
      },
    }),
  ]);

  const durationMs = Date.now() - startTime;

  logger.info("system_maintenance_prune_completed", {
    expiredSessionsPruned: sessionsRes.count,
    expiredResetTokensPruned: tokensRes.count,
    staleLoginThrottlesPruned: throttlesRes.count,
    durationMs,
  });

  return {
    expiredSessionsPruned: sessionsRes.count,
    expiredResetTokensPruned: tokensRes.count,
    staleLoginThrottlesPruned: throttlesRes.count,
    durationMs,
  };
}
