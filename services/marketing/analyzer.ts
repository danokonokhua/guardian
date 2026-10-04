import "server-only";

import type { Prisma } from "@prisma/client";
import {
  recordFindingWithClient,
  resolveFindingScoped,
  issueFingerprint,
} from "@/lib/issue-engine";
import type {
  CampaignWithLatestSnapshot,
  ChannelPerformanceItem,
  CrossChannelOverview,
  MarketingMetricSnapshotRecord,
} from "./types";

/**
 * Calculates CTR, CPC, CPL, and ROAS from primary raw figures.
 */
export function calculateDerivedMetrics(data: {
  impressions: number;
  clicks: number;
  spendCents: number;
  conversions: number;
  revenueCents?: number | null;
}): {
  ctrPct: number;
  cpcCents: number;
  costPerLeadCents: number;
  roas: number;
} {
  const impressions = Math.max(0, data.impressions);
  const clicks = Math.max(0, data.clicks);
  const spendCents = Math.max(0, data.spendCents);
  const conversions = Math.max(0, data.conversions);
  const revenueCents = Math.max(0, data.revenueCents ?? 0);

  const ctrPct = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0;
  const cpcCents = clicks > 0 ? Math.round(spendCents / clicks) : 0;
  const costPerLeadCents = conversions > 0 ? Math.round(spendCents / conversions) : spendCents;
  const roas = spendCents > 0 ? Number((revenueCents / spendCents).toFixed(2)) : 0;

  return {
    ctrPct,
    cpcCents,
    costPerLeadCents,
    roas,
  };
}

/**
 * Aggregates campaigns and snapshots into cross-channel totals and per-channel distribution.
 */
export function aggregateCrossChannelMetrics(
  campaigns: CampaignWithLatestSnapshot[],
  websiteId: string | null = null,
): CrossChannelOverview {
  let totalSpendCents = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalConversions = 0;
  let totalRevenueCents = 0;
  let activeCampaignsCount = 0;
  let flaggedCampaignsCount = 0;

  const channelMap = new Map<
    string,
    {
      campaignsCount: number;
      spendCents: number;
      impressions: number;
      clicks: number;
      conversions: number;
      revenueCents: number;
    }
  >();

  for (const campaign of campaigns) {
    if (campaign.status === "ACTIVE") activeCampaignsCount++;

    const snap = campaign.latestSnapshot;
    const spend = snap?.spendCents ?? 0;
    const impressions = snap?.impressions ?? 0;
    const clicks = snap?.clicks ?? 0;
    const conversions = snap?.conversions ?? 0;
    const revenue = snap?.revenueCents ?? 0;

    totalSpendCents += spend;
    totalImpressions += impressions;
    totalClicks += clicks;
    totalConversions += conversions;
    totalRevenueCents += revenue;

    // Check if campaign is flagged
    const isWastingSpend = spend >= 20000 && conversions === 0;
    const isCplHigh = (snap?.costPerLeadCents ?? 0) >= 12000 && spend >= 15000;
    const isCtrFatigued = impressions >= 1000 && (snap?.ctrPct ?? 0) < 0.8;

    if (isWastingSpend || isCplHigh || isCtrFatigued) {
      flaggedCampaignsCount++;
      if (isWastingSpend) {
        campaign.flaggedReason = "Budget drain: >$200 spend with 0 conversions";
      } else if (isCplHigh) {
        campaign.flaggedReason = "CPL Alert: Cost per lead exceeds $120 threshold";
      } else if (isCtrFatigued) {
        campaign.flaggedReason = "Ad Fatigue: CTR below 0.8%";
      }
    }

    const currentChannel = channelMap.get(campaign.channel) ?? {
      campaignsCount: 0,
      spendCents: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      revenueCents: 0,
    };

    currentChannel.campaignsCount++;
    currentChannel.spendCents += spend;
    currentChannel.impressions += impressions;
    currentChannel.clicks += clicks;
    currentChannel.conversions += conversions;
    currentChannel.revenueCents += revenue;

    channelMap.set(campaign.channel, currentChannel);
  }

  // Blended KPIs
  const blendedCtrPct =
    totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0;
  const blendedCpcCents = totalClicks > 0 ? Math.round(totalSpendCents / totalClicks) : 0;
  const blendedCostPerLeadCents =
    totalConversions > 0 ? Math.round(totalSpendCents / totalConversions) : totalSpendCents;
  const blendedRoas =
    totalSpendCents > 0 ? Number((totalRevenueCents / totalSpendCents).toFixed(2)) : 0;

  // Build Channel Performance Items
  const channels: ChannelPerformanceItem[] = Array.from(channelMap.entries()).map(
    ([channel, data]) => {
      const ctrPct =
        data.impressions > 0 ? Number(((data.clicks / data.impressions) * 100).toFixed(2)) : 0;
      const costPerLeadCents =
        data.conversions > 0 ? Math.round(data.spendCents / data.conversions) : data.spendCents;
      const roas =
        data.spendCents > 0 ? Number((data.revenueCents / data.spendCents).toFixed(2)) : 0;
      const spendSharePct =
        totalSpendCents > 0 ? Number(((data.spendCents / totalSpendCents) * 100).toFixed(1)) : 0;
      const leadSharePct =
        totalConversions > 0 ? Number(((data.conversions / totalConversions) * 100).toFixed(1)) : 0;

      return {
        channel,
        campaignsCount: data.campaignsCount,
        spendCents: data.spendCents,
        impressions: data.impressions,
        clicks: data.clicks,
        conversions: data.conversions,
        revenueCents: data.revenueCents,
        costPerLeadCents,
        ctrPct,
        roas,
        spendSharePct,
        leadSharePct,
      };
    },
  );

  return {
    websiteId,
    totalSpendCents,
    totalImpressions,
    totalClicks,
    totalConversions,
    totalRevenueCents,
    blendedCtrPct,
    blendedCpcCents,
    blendedCostPerLeadCents,
    blendedRoas,
    activeCampaignsCount,
    flaggedCampaignsCount,
    channels,
    campaigns,
  };
}

export interface MarketingAnomalyResult {
  detectedCount: number;
  resolvedCount: number;
  issueIds: string[];
}

/**
 * Autonomous Ad Spend Protection: monitors campaigns for budget drains, CPL spikes, and audience fatigue.
 */
export async function detectMarketingAnomalies(
  campaign: { id: string; name: string; channel: string },
  metrics: MarketingMetricSnapshotRecord,
  context: { organizationId: string; websiteId?: string | null },
  prisma: Pick<Prisma.TransactionClient, "website" | "issue" | "issueActivity" | "$executeRaw">,
): Promise<MarketingAnomalyResult> {
  let detectedCount = 0;
  let resolvedCount = 0;
  const issueIds: string[] = [];

  const { organizationId } = context;

  let websiteId = context.websiteId;
  if (!websiteId) {
    const defaultSite = await prisma.website.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!defaultSite) return { detectedCount: 0, resolvedCount: 0, issueIds: [] };
    websiteId = defaultSite.id;
  }

  const subjectKey = `marketing-${campaign.id}`;

  // 1. RULE_MARKETING_SPEND_WITHOUT_CONVERSIONS
  // Trigger: Incurred >= $200 (20,000 cents) spend with 0 conversions
  if (metrics.spendCents >= 20000 && metrics.conversions === 0) {
    const spendFormatted = `$${(metrics.spendCents / 100).toFixed(2)}`;
    const finding = await recordFindingWithClient(
      {
        organizationId,
        websiteId,
        ruleId: "RULE_MARKETING_SPEND_WITHOUT_CONVERSIONS",
        subjectKey: `${subjectKey}-drain`,
        severity: "HIGH",
        title: `Ad Budget Drain: ${campaign.name} spent ${spendFormatted} with 0 conversions`,
        summary: `Campaign "${campaign.name}" (${campaign.channel}) has accumulated ${spendFormatted} in ad spend without recording a single lead or conversion.`,
        businessImpact:
          "Unmonitored ad campaigns without conversion tracking or failing landing pages quickly burn marketing budgets with zero pipeline return.",
        impactConfidence: 0.9,
        recommendedAction:
          "Pause this campaign immediately, verify that conversion tracking tags are firing on the landing page, and check form submit reliability.",
        technicalEvidence: {
          campaignId: campaign.id,
          campaignName: campaign.name,
          channel: campaign.channel,
          spendCents: metrics.spendCents,
          clicks: metrics.clicks,
          conversions: 0,
        },
      },
      prisma,
    );
    detectedCount++;
    issueIds.push(finding.id);
  } else {
    const fp = issueFingerprint({
      ruleId: "RULE_MARKETING_SPEND_WITHOUT_CONVERSIONS",
      websiteId,
      subjectKey: `${subjectKey}-drain`,
    });
    await resolveFindingScoped({ organizationId }, fp, prisma as any);
    resolvedCount++;
  }

  // 2. RULE_MARKETING_CPL_SPIKE
  // Trigger: Cost Per Lead exceeds $120 threshold with >= $150 total spend
  if (metrics.costPerLeadCents >= 12000 && metrics.spendCents >= 15000 && metrics.conversions > 0) {
    const cplFormatted = `$${(metrics.costPerLeadCents / 100).toFixed(2)}`;
    const finding = await recordFindingWithClient(
      {
        organizationId,
        websiteId,
        ruleId: "RULE_MARKETING_CPL_SPIKE",
        subjectKey: `${subjectKey}-cpl`,
        severity: "HIGH",
        title: `Cost Per Lead Alert: ${campaign.name} CPL spiked to ${cplFormatted}`,
        summary: `Customer acquisition cost for "${campaign.name}" has reached ${cplFormatted}/lead, exceeding the $120 target economic threshold.`,
        businessImpact:
          "High acquisition costs compress unit margins and may result in unprofitable customer acquisition if lifetime value is under target.",
        impactConfidence: 0.85,
        recommendedAction:
          "Refine audience targeting parameters, add negative keywords, or test new ad copy to lower cost per lead.",
        technicalEvidence: {
          campaignName: campaign.name,
          channel: campaign.channel,
          costPerLeadCents: metrics.costPerLeadCents,
          conversions: metrics.conversions,
          spendCents: metrics.spendCents,
        },
      },
      prisma,
    );
    detectedCount++;
    issueIds.push(finding.id);
  } else {
    const fp = issueFingerprint({
      ruleId: "RULE_MARKETING_CPL_SPIKE",
      websiteId,
      subjectKey: `${subjectKey}-cpl`,
    });
    await resolveFindingScoped({ organizationId }, fp, prisma as any);
    resolvedCount++;
  }

  // 3. RULE_MARKETING_CTR_DEGRADATION
  // Trigger: High impression volume (>= 1,000) but CTR < 0.8%
  if (metrics.impressions >= 1000 && metrics.ctrPct < 0.8) {
    const finding = await recordFindingWithClient(
      {
        organizationId,
        websiteId,
        ruleId: "RULE_MARKETING_CTR_DEGRADATION",
        subjectKey: `${subjectKey}-ctr`,
        severity: "MEDIUM",
        title: `Ad Fatigue: ${campaign.name} CTR dropped to ${metrics.ctrPct}%`,
        summary: `Campaign "${campaign.name}" has generated ${metrics.impressions} impressions but achieved only ${metrics.ctrPct}% CTR (below the 0.8% benchmark).`,
        businessImpact:
          "Low click-through rates penalize ad quality scores on Google Ads and Meta, driving up effective cost-per-click and ad prices.",
        impactConfidence: 0.75,
        recommendedAction:
          "Refresh creative visual assets, update headline hooks, or test tighter lookalike audiences to restore engagement.",
        technicalEvidence: {
          campaignName: campaign.name,
          channel: campaign.channel,
          impressions: metrics.impressions,
          clicks: metrics.clicks,
          ctrPct: metrics.ctrPct,
        },
      },
      prisma,
    );
    detectedCount++;
    issueIds.push(finding.id);
  } else {
    const fp = issueFingerprint({
      ruleId: "RULE_MARKETING_CTR_DEGRADATION",
      websiteId,
      subjectKey: `${subjectKey}-ctr`,
    });
    await resolveFindingScoped({ organizationId }, fp, prisma as any);
    resolvedCount++;
  }

  return { detectedCount, resolvedCount, issueIds };
}
