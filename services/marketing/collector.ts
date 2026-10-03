import "server-only";

import { calculateDerivedMetrics } from "./analyzer";

export interface SeedCampaignData {
  channel: string;
  externalCampaignId: string;
  name: string;
  status: string;
  budgetDailyCents: number;
  impressions: number;
  clicks: number;
  spendCents: number;
  conversions: number;
  revenueCents: number;
}

/**
 * Returns deterministic high-fidelity demo campaigns across Google, Meta, LinkedIn, and Email channels.
 */
export function getSandboxMarketingSeedData(): SeedCampaignData[] {
  return [
    {
      channel: "GOOGLE_ADS",
      externalCampaignId: "gads-search-core",
      name: "High-Intent Brand & Core Search",
      status: "ACTIVE",
      budgetDailyCents: 8000, // $80/day
      impressions: 12400,
      clicks: 480,
      spendCents: 52000, // $520
      conversions: 24, // 24 leads
      revenueCents: 185000, // $1,850 (ROAS: 3.56)
    },
    {
      channel: "META_ADS",
      externalCampaignId: "meta-retarget-luminous",
      name: "Advantage+ Website Visitors Retargeting",
      status: "ACTIVE",
      budgetDailyCents: 5000, // $50/day
      impressions: 18900,
      clicks: 420,
      spendCents: 34000, // $340
      conversions: 16, // 16 leads
      revenueCents: 98000, // $980 (ROAS: 2.88)
    },
    {
      channel: "LINKEDIN_ADS",
      externalCampaignId: "li-b2b-execs",
      name: "Enterprise Decision-Maker Sponsored Content",
      status: "ACTIVE",
      budgetDailyCents: 6000, // $60/day
      impressions: 4200,
      clicks: 110,
      spendCents: 45000, // $450
      conversions: 3, // 3 leads -> CPL $150 (Triggers RULE_MARKETING_CPL_SPIKE)
      revenueCents: 65000,
    },
    {
      channel: "GOOGLE_ADS",
      externalCampaignId: "gads-display-cold",
      name: "Broad Discovery Display Network",
      status: "ACTIVE",
      budgetDailyCents: 4000, // $40/day
      impressions: 28500,
      clicks: 580,
      spendCents: 26000, // $260
      conversions: 0, // 0 conversions -> (Triggers RULE_MARKETING_SPEND_WITHOUT_CONVERSIONS)
      revenueCents: 0,
    },
    {
      channel: "EMAIL_MARKETING",
      externalCampaignId: "email-nurture-v2",
      name: "Autonomous Retention & Nurture Sequences",
      status: "ACTIVE",
      budgetDailyCents: 1500, // $15/day
      impressions: 6200,
      clicks: 740,
      spendCents: 7500, // $75
      conversions: 32, // 32 leads
      revenueCents: 92000, // $920 (ROAS: 12.27)
    },
  ];
}

