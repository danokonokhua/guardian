import "server-only";

import type { Prisma } from "@prisma/client";
import type { TenantScope } from "@/db/tenant";
import { withTenantTransaction } from "@/db/tenant";
import type {
  CampaignWithLatestSnapshot,
  MarketingCampaignRecord,
  MarketingMetricSnapshotRecord,
} from "./types";

const campaignSelect = {
  id: true,
  organizationId: true,
  websiteId: true,
  channel: true,
  externalCampaignId: true,
  name: true,
  status: true,
  currency: true,
  budgetDailyCents: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
} as const;

const snapshotSelect = {
  id: true,
  campaignId: true,
  organizationId: true,
  periodStart: true,
  periodEnd: true,
  impressions: true,
  clicks: true,
  spendCents: true,
  conversions: true,
  revenueCents: true,
  ctrPct: true,
  cpcCents: true,
  costPerLeadCents: true,
  roas: true,
  metadata: true,
  createdAt: true,
} as const;

export async function listCampaigns(
  scope: TenantScope,
  websiteId?: string,
): Promise<MarketingCampaignRecord[]> {
  return withTenantTransaction(scope, async (tx) => {
    const where: Prisma.MarketingCampaignWhereInput = {
      organizationId: scope.organizationId,
      ...(websiteId ? { websiteId } : {}),
    };
    return tx.marketingCampaign.findMany({
      where,
      select: campaignSelect,
      orderBy: { createdAt: "desc" },
    });
  });
}

export async function findCampaignById(
  scope: TenantScope,
  id: string,
): Promise<MarketingCampaignRecord | null> {
  return withTenantTransaction(scope, async (tx) =>
    tx.marketingCampaign.findFirst({
      where: { id, organizationId: scope.organizationId },
      select: campaignSelect,
    }),
  );
}

export async function findCampaignByExternalId(
  scope: TenantScope,
  channel: string,
  externalCampaignId: string,
): Promise<MarketingCampaignRecord | null> {
  return withTenantTransaction(scope, async (tx) =>
    tx.marketingCampaign.findFirst({
      where: {
        organizationId: scope.organizationId,
        channel,
        externalCampaignId,
      },
      select: campaignSelect,
    }),
  );
}

export async function createCampaign(
  scope: TenantScope,
  data: {
    websiteId?: string | null;
    channel: string;
    externalCampaignId?: string | null;
    name: string;
    currency?: string;
    budgetDailyCents?: number | null;
    startDate?: Date | null;
    endDate?: Date | null;
  },
): Promise<MarketingCampaignRecord> {
  return withTenantTransaction(scope, async (tx) =>
    tx.marketingCampaign.create({
      data: {
        organizationId: scope.organizationId,
        websiteId: data.websiteId ?? null,
        channel: data.channel,
        externalCampaignId: data.externalCampaignId ?? null,
        name: data.name,
        status: "ACTIVE",
        currency: data.currency ?? "USD",
        budgetDailyCents: data.budgetDailyCents ?? null,
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
      },
      select: campaignSelect,
    }),
  );
}

export async function updateCampaign(
  scope: TenantScope,
  id: string,
  data: {
    name?: string;
    status?: string;
    budgetDailyCents?: number | null;
  },
): Promise<MarketingCampaignRecord> {
  return withTenantTransaction(scope, async (tx) =>
    tx.marketingCampaign.update({
      where: { id, organizationId: scope.organizationId },
      data,
      select: campaignSelect,
    }),
  );
}

export async function deleteCampaign(scope: TenantScope, id: string): Promise<boolean> {
  return withTenantTransaction(scope, async (tx) => {
    const deleted = await tx.marketingCampaign.deleteMany({
      where: { id, organizationId: scope.organizationId },
    });
    return deleted.count > 0;
  });
}

export async function recordSnapshot(
  scope: TenantScope,
  campaignId: string,
  data: {
    periodStart: Date;
    periodEnd: Date;
    impressions: number;
    clicks: number;
    spendCents: number;
    conversions: number;
    revenueCents?: number | null;
    ctrPct: number;
    cpcCents: number;
    costPerLeadCents: number;
    roas?: number | null;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<MarketingMetricSnapshotRecord> {
  return withTenantTransaction(scope, async (tx) =>
    tx.marketingMetricSnapshot.create({
      data: {
        campaignId,
        organizationId: scope.organizationId,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        impressions: data.impressions,
        clicks: data.clicks,
        spendCents: data.spendCents,
        conversions: data.conversions,
        revenueCents: data.revenueCents ?? 0,
        ctrPct: data.ctrPct,
        cpcCents: data.cpcCents,
        costPerLeadCents: data.costPerLeadCents,
        roas: data.roas ?? 0,
        metadata: data.metadata ?? {},
      },
      select: snapshotSelect,
    }),
  );
}

export async function getLatestSnapshot(
  scope: TenantScope,
  campaignId: string,
): Promise<MarketingMetricSnapshotRecord | null> {
  return withTenantTransaction(scope, async (tx) =>
    tx.marketingMetricSnapshot.findFirst({
      where: { campaignId, organizationId: scope.organizationId },
      select: snapshotSelect,
      orderBy: { periodStart: "desc" },
    }),
  );
}

export async function getCampaignSnapshots(
  scope: TenantScope,
  campaignId: string,
  limit = 20,
): Promise<MarketingMetricSnapshotRecord[]> {
  return withTenantTransaction(scope, async (tx) =>
    tx.marketingMetricSnapshot.findMany({
      where: { campaignId, organizationId: scope.organizationId },
      select: snapshotSelect,
      orderBy: { periodStart: "desc" },
      take: Math.min(Math.max(limit, 1), 100),
    }),
  );
}

export async function getCampaignsWithLatestSnapshots(
  scope: TenantScope,
  websiteId?: string,
): Promise<CampaignWithLatestSnapshot[]> {
  return withTenantTransaction(scope, async (tx) => {
    const campaigns = await tx.marketingCampaign.findMany({
      where: {
        organizationId: scope.organizationId,
        ...(websiteId ? { websiteId } : {}),
      },
      select: campaignSelect,
      orderBy: { createdAt: "desc" },
    });

    return Promise.all(
      campaigns.map(async (c) => {
        const latest = await tx.marketingMetricSnapshot.findFirst({
          where: { campaignId: c.id, organizationId: scope.organizationId },
          select: snapshotSelect,
          orderBy: { periodStart: "desc" },
        });
        return {
          ...c,
          latestSnapshot: latest,
        };
      }),
    );
  });
}
