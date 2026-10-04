import "server-only";

import { ConflictError, NotFoundError } from "@/lib/errors";
import { expiryConfigSchema } from "@/lib/domain-expiry/config";
import { parseWith } from "@/lib/validation";
import type { MonitorType } from "@prisma/client";
import type { TenantScope } from "@/db/tenant";
import { withTenantTransaction } from "@/db/tenant";
import { getPrisma } from "@/db/client";
import { logger } from "@/lib/logger";
import { deleteMonitorDispatch, upsertMonitorDispatch } from "@/lib/jobs/dispatch";

export interface MonitorRecord {
  id: string;
  websiteId: string;
  type: MonitorType;
  enabled: boolean;
  frequencyMinutes: number;
  config: unknown;
  results?: {
    status: string;
    checkedAt: Date;
    responseTimeMs: number | null;
    httpStatusCode: number | null;
  }[];
}

const select = {
  id: true,
  websiteId: true,
  type: true,
  enabled: true,
  frequencyMinutes: true,
  config: true,
  results: {
    orderBy: { checkedAt: "desc" },
    take: 1,
    select: { status: true, checkedAt: true, responseTimeMs: true, httpStatusCode: true },
  },
} as const;

export function listMonitors(scope: TenantScope): Promise<MonitorRecord[]> {
  return withTenantTransaction(scope, async (tx) =>
    tx.monitor.findMany({ where: { organizationId: scope.organizationId }, select }),
  );
}

export function findMonitor(scope: TenantScope, monitorId: string): Promise<MonitorRecord | null> {
  return withTenantTransaction(scope, async (tx) =>
    tx.monitor.findFirst({
      where: { id: monitorId, organizationId: scope.organizationId },
      select,
    }),
  );
}

export async function createMonitor(
  scope: TenantScope,
  input: {
    websiteId: string;
    type: MonitorType;
    enabled: boolean;
    frequencyMinutes: number;
    config: object;
  },
): Promise<MonitorRecord> {
  const monitor = await withTenantTransaction(scope, async (tx) => {
    const website = await tx.website.findFirst({
      where: { id: input.websiteId, organizationId: scope.organizationId },
      select: { id: true },
    });
    if (!website) throw new NotFoundError("Website");
    return tx.monitor.create({
      data: { organizationId: scope.organizationId, ...input },
      select,
    });
  });

  try {
    await upsertMonitorDispatch(getPrisma(), {
      monitorId: monitor.id,
      organizationId: scope.organizationId,
      websiteId: monitor.websiteId,
      type: monitor.type,
      enabled: monitor.enabled,
      frequencyMinutes: monitor.frequencyMinutes,
      nextRunAt: new Date(),
    });
  } catch (dispatchError) {
    logger.warn("monitor_dispatch_upsert_failed", {
      monitorId: monitor.id,
      error: dispatchError instanceof Error ? dispatchError.message : String(dispatchError),
    });
  }

  return monitor;
}

export async function updateMonitor(
  scope: TenantScope,
  monitorId: string,
  input: { enabled?: boolean; frequencyMinutes?: number; config?: object },
): Promise<MonitorRecord | null> {
  const result = await withTenantTransaction(scope, async (tx) => {
    await tx.$executeRaw`SELECT id FROM monitoring_checks WHERE id = ${monitorId} FOR UPDATE`;
    const existing = await tx.monitor.findFirst({
      where: { id: monitorId, organizationId: scope.organizationId },
      select: {
        id: true,
        websiteId: true,
        type: true,
        enabled: true,
        frequencyMinutes: true,
        config: true,
      },
    });
    if (!existing) return null;
    if (existing.type === "ACCESSIBILITY") {
      if (input.config !== undefined)
        throw new ConflictError(
          "Accessibility evidence is read-only. Run a new check to refresh it.",
        );
      if (input.frequencyMinutes !== undefined && input.frequencyMinutes < 60)
        throw new ConflictError("Accessibility checks must be at least 60 minutes apart.");
    }
    if (existing.type === "EMAIL_HEALTH") {
      if (input.config !== undefined)
        throw new ConflictError(
          "Email policy evidence is read-only. Recreate the monitor to change its domain scope.",
        );
      if (input.frequencyMinutes !== undefined && input.frequencyMinutes < 60)
        throw new ConflictError("Email policy checks must be at least 60 minutes apart.");
    }
    if (existing.type === "DOMAIN_EXPIRY") {
      if (input.frequencyMinutes !== undefined && input.frequencyMinutes < 60)
        throw new ConflictError("Domain expiry checks must be at least 60 minutes apart.");
      if (input.config !== undefined)
        input = {
          ...input,
          config: {
            ...(existing.config as object),
            ...parseWith(expiryConfigSchema, input.config, "monitor.config"),
          },
        };
    }
    if (existing.type === "DNS" && input.config !== undefined)
      throw new ConflictError("Use DNS baseline acceptance to change DNS state.");
    return tx.monitor.update({ where: { id: monitorId }, data: input, select });
  });

  if (result) {
    try {
      await upsertMonitorDispatch(getPrisma(), {
        monitorId: result.id,
        organizationId: scope.organizationId,
        websiteId: result.websiteId,
        type: result.type,
        enabled: result.enabled,
        frequencyMinutes: result.frequencyMinutes,
        nextRunAt:
          input.enabled !== undefined || input.frequencyMinutes !== undefined
            ? new Date()
            : undefined,
      });
    } catch (dispatchError) {
      logger.warn("monitor_dispatch_upsert_failed", {
        monitorId: result.id,
        error: dispatchError instanceof Error ? dispatchError.message : String(dispatchError),
      });
    }
  }

  return result;
}

export async function deleteMonitor(scope: TenantScope, monitorId: string): Promise<boolean> {
  const deleted = await withTenantTransaction(scope, async (tx) => {
    const existing = await tx.monitor.findFirst({
      where: { id: monitorId, organizationId: scope.organizationId },
      select: { id: true },
    });
    if (!existing) return false;
    await tx.monitor.delete({ where: { id: monitorId } });
    return true;
  });

  if (deleted) {
    try {
      await deleteMonitorDispatch(getPrisma(), monitorId);
    } catch (dispatchError) {
      logger.warn("monitor_dispatch_delete_failed", {
        monitorId,
        error: dispatchError instanceof Error ? dispatchError.message : String(dispatchError),
      });
    }
  }

  return deleted;
}
