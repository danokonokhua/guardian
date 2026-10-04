import "server-only";

import type { Prisma } from "@prisma/client";

export type DispatchWriteClient = Pick<Prisma.TransactionClient, "$executeRaw">;
export type DispatchSqlClient = DispatchWriteClient & Pick<Prisma.TransactionClient, "$queryRaw">;

export interface MonitorDispatch {
  monitorId: string;
  organizationId: string;
  websiteId: string;
  type: string;
  enabled: boolean;
  frequencyMinutes: number;
  nextRunAt: Date;
}

export interface SlaDispatch {
  organizationId: string;
  frequencyMinutes: number;
  nextRunAt: Date;
}

type MonitorDispatchRow = {
  monitor_id: string;
  organization_id: string;
  website_id: string;
  monitor_type: string;
  enabled: boolean;
  frequency_minutes: number;
  next_run_at: Date;
};

type SlaDispatchRow = {
  organization_id: string;
  frequency_minutes: number;
  next_run_at: Date;
};

const toMonitorDispatch = (row: MonitorDispatchRow): MonitorDispatch => ({
  monitorId: row.monitor_id,
  organizationId: row.organization_id,
  websiteId: row.website_id,
  type: row.monitor_type,
  enabled: row.enabled,
  frequencyMinutes: row.frequency_minutes,
  nextRunAt: row.next_run_at,
});

const toSlaDispatch = (row: SlaDispatchRow): SlaDispatch => ({
  organizationId: row.organization_id,
  frequencyMinutes: row.frequency_minutes,
  nextRunAt: row.next_run_at,
});

export async function upsertMonitorDispatch(
  client: DispatchWriteClient,
  dispatch: Omit<MonitorDispatch, "nextRunAt"> & { nextRunAt?: Date },
): Promise<void> {
  const nextRunAt = dispatch.nextRunAt ?? new Date();
  await client.$executeRaw`
    INSERT INTO "guardian_jobs"."monitor_dispatch"
      ("monitor_id", "organization_id", "website_id", "monitor_type", "enabled", "frequency_minutes", "next_run_at", "updated_at")
    VALUES
      (${dispatch.monitorId}, ${dispatch.organizationId}, ${dispatch.websiteId}, ${dispatch.type}, ${dispatch.enabled}, ${dispatch.frequencyMinutes}, ${nextRunAt}, CURRENT_TIMESTAMP)
    ON CONFLICT ("monitor_id") DO UPDATE SET
      "organization_id" = EXCLUDED."organization_id",
      "website_id" = EXCLUDED."website_id",
      "monitor_type" = EXCLUDED."monitor_type",
      "enabled" = EXCLUDED."enabled",
      "frequency_minutes" = EXCLUDED."frequency_minutes",
      "next_run_at" = COALESCE(${dispatch.nextRunAt ?? null}, "guardian_jobs"."monitor_dispatch"."next_run_at"),
      "updated_at" = CURRENT_TIMESTAMP
  `;
}

export async function deleteMonitorDispatch(
  client: DispatchWriteClient,
  monitorId: string,
): Promise<void> {
  await client.$executeRaw`
    DELETE FROM "guardian_jobs"."monitor_dispatch"
    WHERE "monitor_id" = ${monitorId}
  `;
}

export async function listDueMonitorDispatches(
  client: DispatchSqlClient,
  limit = 100,
): Promise<MonitorDispatch[]> {
  const rows = await client.$queryRaw<MonitorDispatchRow[]>`
    SELECT "monitor_id", "organization_id", "website_id", "monitor_type", "enabled", "frequency_minutes", "next_run_at"
    FROM "guardian_jobs"."monitor_dispatch"
    WHERE "enabled" = TRUE AND "next_run_at" <= CURRENT_TIMESTAMP
    ORDER BY "next_run_at" ASC
    LIMIT ${limit}
  `;
  return rows.map(toMonitorDispatch);
}

export async function claimMonitorDispatch(
  client: DispatchSqlClient,
  monitorId: string,
): Promise<MonitorDispatch | null> {
  const rows = await client.$queryRaw<MonitorDispatchRow[]>`
    UPDATE "guardian_jobs"."monitor_dispatch"
    SET "next_run_at" = CURRENT_TIMESTAMP + ("frequency_minutes" * interval '1 minute'),
        "updated_at" = CURRENT_TIMESTAMP
    WHERE "monitor_id" = ${monitorId}
      AND "enabled" = TRUE
      AND "next_run_at" <= CURRENT_TIMESTAMP
    RETURNING "monitor_id", "organization_id", "website_id", "monitor_type", "enabled", "frequency_minutes", "next_run_at"
  `;
  return rows[0] ? toMonitorDispatch(rows[0]) : null;
}

export async function releaseMonitorDispatch(
  client: DispatchWriteClient,
  monitorId: string,
): Promise<void> {
  await client.$executeRaw`
    UPDATE "guardian_jobs"."monitor_dispatch"
    SET "next_run_at" = CURRENT_TIMESTAMP, "updated_at" = CURRENT_TIMESTAMP
    WHERE "monitor_id" = ${monitorId}
  `;
}

export async function upsertSlaDispatch(
  client: DispatchWriteClient,
  organizationId: string,
  nextRunAt = new Date(),
): Promise<void> {
  await client.$executeRaw`
    INSERT INTO "guardian_jobs"."sla_dispatch"
      ("organization_id", "next_run_at", "updated_at")
    VALUES (${organizationId}, ${nextRunAt}, CURRENT_TIMESTAMP)
    ON CONFLICT ("organization_id") DO UPDATE SET
      "next_run_at" = LEAST("guardian_jobs"."sla_dispatch"."next_run_at", EXCLUDED."next_run_at"),
      "updated_at" = CURRENT_TIMESTAMP
  `;
}

export async function deleteSlaDispatch(
  client: DispatchWriteClient,
  organizationId: string,
): Promise<void> {
  await client.$executeRaw`
    DELETE FROM "guardian_jobs"."sla_dispatch"
    WHERE "organization_id" = ${organizationId}
  `;
}

export async function listDueSlaDispatches(
  client: DispatchSqlClient,
  limit = 1000,
): Promise<SlaDispatch[]> {
  const rows = await client.$queryRaw<SlaDispatchRow[]>`
    SELECT "organization_id", "frequency_minutes", "next_run_at"
    FROM "guardian_jobs"."sla_dispatch"
    WHERE "next_run_at" <= CURRENT_TIMESTAMP
    ORDER BY "next_run_at" ASC
    LIMIT ${limit}
  `;
  return rows.map(toSlaDispatch);
}

export async function claimSlaDispatch(
  client: DispatchSqlClient,
  organizationId: string,
): Promise<SlaDispatch | null> {
  const rows = await client.$queryRaw<SlaDispatchRow[]>`
    UPDATE "guardian_jobs"."sla_dispatch"
    SET "next_run_at" = CURRENT_TIMESTAMP + ("frequency_minutes" * interval '1 minute'),
        "updated_at" = CURRENT_TIMESTAMP
    WHERE "organization_id" = ${organizationId}
      AND "next_run_at" <= CURRENT_TIMESTAMP
    RETURNING "organization_id", "frequency_minutes", "next_run_at"
  `;
  return rows[0] ? toSlaDispatch(rows[0]) : null;
}

export async function releaseSlaDispatch(
  client: DispatchWriteClient,
  organizationId: string,
): Promise<void> {
  await client.$executeRaw`
    UPDATE "guardian_jobs"."sla_dispatch"
    SET "next_run_at" = CURRENT_TIMESTAMP, "updated_at" = CURRENT_TIMESTAMP
    WHERE "organization_id" = ${organizationId}
  `;
}
