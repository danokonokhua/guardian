import "server-only";

import type { TenantScope } from "@/db/tenant";
import { withTenantTransaction } from "@/db/tenant";
import { assertCanUseMarketingIntelligence } from "@/lib/billing/entitlements";
import { ValidationError, ConflictError, NotFoundError } from "@/lib/errors";
import {
  calculateDerivedMetrics,
  aggregateCrossChannelMetrics,
  detectMarketingAnomalies,
  type MarketingAnomalyResult,
} from "./analyzer";
import { getSandboxMarketingSeedData } from "./collector";
import {
  listCampaigns,
  findCampaignById,
  findCampaignByExternalId,
  createCampaign,
  updateCampaign as repoUpdateCampaign,
  deleteCampaign as repoDeleteCampaign,
  recordSnapshot,
  getLatestSnapshot,
  getCampaignSnapshots,
  getCampaignsWithLatestSnapshots,
} from "./repository";
import type {
  CampaignWithLatestSnapshot,
  CrossChannelOverview,
  MarketingCampaignRecord,
  MarketingMetricSnapshotRecord,
} from "./types";

export interface RegisterCampaignInput {
  name: string;
  channel: string;
  externalCampaignId?: string | null;
  websiteId?: string | null;
  currency?: string;
  budgetDailyCents?: number | null;
  planId?: string;
}

export interface RecordMetricsInput {
  periodStart: Date;
  periodEnd: Date;
  impressions: number;
  clicks: number;
  spendCents: number;
  conversions: number;
  revenueCents?: number | null;
  metadata?: any;
}

/**
 * Registers a new marketing campaign and validates plan entitlement.
 */
export async function registerCampaign(
  scope: TenantScope,
  input: RegisterCampaignInput,
): Promise<MarketingCampaignRecord> {
  // 1. Verify plan entitlement
  if (input.planId) {
    assertCanUseMarketingIntelligence(input.planId);
  } else {
    const org = await withTenantTransaction(scope, async (tx) =>
      tx.organization.findUnique({
        where: { id: scope.organizationId },
        select: { plan: true },
      }),
    );
    if (org?.plan) {
      assertCanUseMarketingIntelligence(org.plan);
    }
  }

  if (!input.name || input.name.trim().length === 0) {
    throw new ValidationError("Campaign name is required");
  }

  const validChannels = ["GOOGLE_ADS", "META_ADS", "LINKEDIN_ADS", "EMAIL_MARKETING", "DIRECT_CRM"];
  if (!validChannels.includes(input.channel)) {
    throw new ValidationError(
      `Invalid channel "${input.channel}". Must be one of: ${validChannels.join(", ")}`,
    );
  }

  // 2. Prevent duplicate channel + external ID
  if (input.externalCampaignId) {
    const existing = await findCampaignByExternalId(scope, input.channel, input.externalCampaignId);
    if (existing) {
      throw new ConflictError(
        `Campaign "${input.externalCampaignId}" on ${input.channel} already exists in your workspace`,
      );
    }
  }

  return createCampaign(scope, {
    websiteId: input.websiteId ?? null,
    channel: input.channel,
    externalCampaignId: input.externalCampaignId ?? null,
    name: input.name.trim(),
    currency: input.currency ?? "USD",
    budgetDailyCents: input.budgetDailyCents ?? null,
  });
}

/**
 * Records a performance metric snapshot and evaluates ad spend protection anomaly rules.
 */
export async function recordCampaignMetrics(
  scope: TenantScope,
  campaignId: string,
  input: RecordMetricsInput,
): Promise<{
  snapshot: MarketingMetricSnapshotRecord;
  anomalies: MarketingAnomalyResult;
}> {
  const campaign = await findCampaignById(scope, campaignId);
  if (!campaign) {
    throw new NotFoundError(`Campaign ${campaignId} not found`);
  }

  const derived = calculateDerivedMetrics({
    impressions: input.impressions,
    clicks: input.clicks,
    spendCents: input.spendCents,
    conversions: input.conversions,
    revenueCents: input.revenueCents,
  });

  const snapshot = await recordSnapshot(scope, campaignId, {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    impressions: input.impressions,
    clicks: input.clicks,
    spendCents: input.spendCents,
    conversions: input.conversions,
    revenueCents: input.revenueCents ?? 0,
    ctrPct: derived.ctrPct,
    cpcCents: derived.cpcCents,
    costPerLeadCents: derived.costPerLeadCents,
    roas: derived.roas,
    metadata: input.metadata ?? {},
  });

  // Run anomaly detection in tenant transaction
  const anomalies = await withTenantTransaction(scope, async (tx) => {
    return detectMarketingAnomalies(
      campaign,
      snapshot,
      {
        organizationId: scope.organizationId,
        websiteId: campaign.websiteId,
      },
      tx,
    );
  });

  return { snapshot, anomalies };
}

/**
 * Seeds realistic multi-channel campaigns for testing and demonstration.
 */
export async function seedSandboxMarketingCampaigns(
  scope: TenantScope,
  websiteId?: string,
): Promise<CrossChannelOverview> {
  const seedItems = getSandboxMarketingSeedData();
  const now = new Date();
  const periodStart = new Date(now.getTime() - 7 * 86400000); // 7 days ago

  for (const item of seedItems) {
    let campaign = await findCampaignByExternalId(scope, item.channel, item.externalCampaignId);
    if (!campaign) {
      campaign = await createCampaign(scope, {
        websiteId: websiteId ?? null,
        channel: item.channel,
        externalCampaignId: item.externalCampaignId,
        name: item.name,
        budgetDailyCents: item.budgetDailyCents,
      });
    }

    await recordCampaignMetrics(scope, campaign.id, {
      periodStart,
      periodEnd: now,
      impressions: item.impressions,
      clicks: item.clicks,
      spendCents: item.spendCents,
      conversions: item.conversions,
      revenueCents: item.revenueCents,
    });
  }

  return getCrossChannelPerformance(scope, websiteId);
}

/**
 * Aggregates all cross-channel campaigns, calculates blended KPIs, and flags budget waste.
 */
export async function getCrossChannelPerformance(
  scope: TenantScope,
  websiteId?: string,
): Promise<CrossChannelOverview> {
  const campaigns = await getCampaignsWithLatestSnapshots(scope, websiteId);
  return aggregateCrossChannelMetrics(campaigns, websiteId ?? null);
}

/**
 * Retrieves campaign details with full snapshot history.
 */
export async function getCampaignDetails(
  scope: TenantScope,
  campaignId: string,
): Promise<{
  campaign: MarketingCampaignRecord;
  latestSnapshot: MarketingMetricSnapshotRecord | null;
  snapshots: MarketingMetricSnapshotRecord[];
}> {
  const campaign = await findCampaignById(scope, campaignId);
  if (!campaign) {
    throw new NotFoundError(`Campaign ${campaignId} not found`);
  }

  const [latestSnapshot, snapshots] = await Promise.all([
    getLatestSnapshot(scope, campaignId),
    getCampaignSnapshots(scope, campaignId, 30),
  ]);

  return {
    campaign,
    latestSnapshot,
    snapshots,
  };
}

/**
 * Updates campaign details.
 */
export async function updateCampaignDetails(
  scope: TenantScope,
  campaignId: string,
  data: { name?: string; status?: string; budgetDailyCents?: number | null },
): Promise<MarketingCampaignRecord> {
  const campaign = await findCampaignById(scope, campaignId);
  if (!campaign) {
    throw new NotFoundError(`Campaign ${campaignId} not found`);
  }

  return repoUpdateCampaign(scope, campaignId, data);
}

/**
 * Deletes a campaign.
 */
export async function removeCampaign(scope: TenantScope, campaignId: string): Promise<boolean> {
  const campaign = await findCampaignById(scope, campaignId);
  if (!campaign) {
    throw new NotFoundError(`Campaign ${campaignId} not found`);
  }

  return repoDeleteCampaign(scope, campaignId);
}
