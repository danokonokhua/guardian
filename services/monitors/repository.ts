import "server-only";

import type { MonitorType } from "@prisma/client";
import type { TenantScope } from "@/db/tenant";
import { withTenantTransaction } from "@/db/tenant";
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

export function createMonitor(
  scope: TenantScope,
  input: {
    websiteId: string;
    type: MonitorType;
    enabled: boolean;
    frequencyMinutes: number;
    config: object;
  },
): Promise<MonitorRecord> {
  return withTenantTransaction(scope, async (tx) => {
    const website = await tx.website.findFirst({
      where: { id: input.websiteId, organizationId: scope.organizationId },
      select: { id: true },
    });
    if (!website) throw new Error("Website not found.");
    const monitor = await tx.monitor.create({
      data: { organizationId: scope.organizationId, ...input },
      select,
    });
    await upsertMonitorDispatch(tx, {
      monitorId: monitor.id,
      organizationId: scope.organizationId,
      websiteId: monitor.websiteId,
      type: monitor.type,
      enabled: monitor.enabled,
      frequencyMinutes: monitor.frequencyMinutes,
      nextRunAt: new Date(),
    });
    return monitor;
  });
}

export function updateMonitor(
  scope: TenantScope,
  monitorId: string,
  input: { enabled?: boolean; frequencyMinutes?: number; config?: object },
): Promise<MonitorRecord | null> {
  return withTenantTransaction(scope, async (tx) => {
    const existing = await tx.monitor.findFirst({
      where: { id: monitorId, organizationId: scope.organizationId },
      select: {
        id: true,
        websiteId: true,
        type: true,
        enabled: true,
        frequencyMinutes: true,
      },
    });
    if (!existing) return null;
    const monitor = await tx.monitor.update({ where: { id: monitorId }, data: input, select });
    await upsertMonitorDispatch(tx, {
      monitorId: monitor.id,
      organizationId: scope.organizationId,
      websiteId: monitor.websiteId,
      type: monitor.type,
      enabled: monitor.enabled,
      frequencyMinutes: monitor.frequencyMinutes,
      nextRunAt:
        input.enabled !== undefined || input.frequencyMinutes !== undefined
          ? new Date()
          : undefined,
    });
    return monitor;
  });
}

export function deleteMonitor(scope: TenantScope, monitorId: string): Promise<boolean> {
  return withTenantTransaction(scope, async (tx) => {
    const existing = await tx.monitor.findFirst({
      where: { id: monitorId, organizationId: scope.organizationId },
      select: { id: true },
    });
    if (!existing) return false;
    await deleteMonitorDispatch(tx, monitorId);
    await tx.monitor.delete({ where: { id: monitorId } });
    return true;
  });
}
