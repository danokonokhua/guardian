import type { Prisma } from "@prisma/client";

export type MarketingChannel =
  | "GOOGLE_ADS"
  | "META_ADS"
  | "LINKEDIN_ADS"
  | "EMAIL_MARKETING"
  | "DIRECT_CRM";

export interface MarketingCampaignRecord {
  id: string;
  organizationId: string;
  websiteId: string | null;
  channel: string;
  externalCampaignId: string | null;
  name: string;
  status: string; // ACTIVE, PAUSED, COMPLETED, ARCHIVED
  currency: string;
  budgetDailyCents: number | null;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketingMetricSnapshotRecord {
  id: string;
  campaignId: string;
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
  impressions: number;
  clicks: number;
  spendCents: number;
  conversions: number;
  revenueCents: number | null;
  ctrPct: number;
  cpcCents: number;
  costPerLeadCents: number;
  roas: number | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
}

export interface CampaignWithLatestSnapshot extends MarketingCampaignRecord {
  latestSnapshot: MarketingMetricSnapshotRecord | null;
  flaggedReason?: string | null;
}

export interface ChannelPerformanceItem {
  channel: string;
  campaignsCount: number;
  spendCents: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenueCents: number;
  costPerLeadCents: number;
  ctrPct: number;
  roas: number;
  spendSharePct: number;
  leadSharePct: number;
}

export interface CrossChannelOverview {
  websiteId: string | null;
  totalSpendCents: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalRevenueCents: number;
  blendedCtrPct: number;
  blendedCpcCents: number;
  blendedCostPerLeadCents: number;
  blendedRoas: number;
  activeCampaignsCount: number;
  flaggedCampaignsCount: number;
  channels: ChannelPerformanceItem[];
  campaigns: CampaignWithLatestSnapshot[];
}

