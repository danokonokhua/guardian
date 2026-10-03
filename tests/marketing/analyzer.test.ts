import { describe, expect, it, vi } from "vitest";
import {
  calculateDerivedMetrics,
  aggregateCrossChannelMetrics,
  detectMarketingAnomalies,
} from "@/services/marketing/analyzer";
import * as issueEngine from "@/lib/issue-engine";

describe("Marketing Intelligence Analyzer", () => {
  describe("calculateDerivedMetrics", () => {
    it("calculates CTR, CPC, CPL, and ROAS accurately", () => {
      const result = calculateDerivedMetrics({
        impressions: 10000,
        clicks: 500, // 5% CTR
        spendCents: 50000, // $500 total spend
        conversions: 20, // 20 leads -> $25 CPL
        revenueCents: 200000, // $2000 revenue -> 4.0 ROAS
      });

      expect(result.ctrPct).toBe(5);
      expect(result.cpcCents).toBe(100); // $1.00 CPC
      expect(result.costPerLeadCents).toBe(2500); // $25.00 CPL
      expect(result.roas).toBe(4);
    });

    it("handles zero division safely", () => {
      const result = calculateDerivedMetrics({
        impressions: 0,
        clicks: 0,
        spendCents: 0,
        conversions: 0,
        revenueCents: 0,
      });

      expect(result.ctrPct).toBe(0);
      expect(result.cpcCents).toBe(0);
      expect(result.costPerLeadCents).toBe(0);
      expect(result.roas).toBe(0);
    });
  });

  describe("aggregateCrossChannelMetrics", () => {
    it("aggregates totals, channel breakdown, and flags budget drain", () => {
      const campaigns: any[] = [
        {
          id: "camp-1",
          name: "Search Core",
          channel: "GOOGLE_ADS",
          status: "ACTIVE",
          latestSnapshot: {
            impressions: 5000,
            clicks: 250,
            spendCents: 30000,
            conversions: 15,
            revenueCents: 90000,
            costPerLeadCents: 2000,
            ctrPct: 5,
          },
        },
        {
          id: "camp-2",
          name: "Display Drain",
          channel: "GOOGLE_ADS",
          status: "ACTIVE",
          latestSnapshot: {
            impressions: 20000,
            clicks: 400,
            spendCents: 25000, // $250 spend with 0 conversions -> flagged
            conversions: 0,
            revenueCents: 0,
            costPerLeadCents: 25000,
            ctrPct: 2,
          },
        },
      ];

      const overview = aggregateCrossChannelMetrics(campaigns, "site-1");

      expect(overview.totalSpendCents).toBe(55000);
      expect(overview.totalConversions).toBe(15);
      expect(overview.activeCampaignsCount).toBe(2);
      expect(overview.flaggedCampaignsCount).toBe(1);
      expect(campaigns[1]?.flaggedReason).toContain("Budget drain");
      expect(overview.channels).toHaveLength(1);
      expect(overview.channels[0]?.channel).toBe("GOOGLE_ADS");
    });
  });

  describe("detectMarketingAnomalies", () => {
    it("detects budget drain, CPL spike, and CTR degradation", async () => {
      const recordSpy = vi
        .spyOn(issueEngine, "recordFindingWithClient")
        .mockResolvedValue({ id: "iss-mkt-1", created: true } as any);
      const resolveSpy = vi
        .spyOn(issueEngine, "resolveFindingScoped")
        .mockResolvedValue(undefined as any);

      const fakePrisma = {
        website: {
          findFirst: vi.fn().mockResolvedValue({ id: "site-1" }),
        },
      } as any;

      const campaign = {
        id: "camp-drain",
        name: "Cold Traffic",
        channel: "META_ADS",
      };

      const metrics: any = {
        spendCents: 25000, // $250 > $200 threshold
        conversions: 0, // 0 conversions -> triggers RULE_MARKETING_SPEND_WITHOUT_CONVERSIONS
        clicks: 300,
        impressions: 15000,
        costPerLeadCents: 25000,
        ctrPct: 0.5, // < 0.8% with 15k impressions -> triggers RULE_MARKETING_CTR_DEGRADATION
      };

      const result = await detectMarketingAnomalies(
        campaign,
        metrics,
        { organizationId: "org-1", websiteId: "site-1" },
        fakePrisma,
      );

      expect(result.detectedCount).toBe(2); // Spend drain + CTR degradation
      expect(recordSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ruleId: "RULE_MARKETING_SPEND_WITHOUT_CONVERSIONS",
          severity: "HIGH",
        }),
        fakePrisma,
      );
      expect(recordSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ruleId: "RULE_MARKETING_CTR_DEGRADATION",
          severity: "MEDIUM",
        }),
        fakePrisma,
      );

      recordSpy.mockRestore();
      resolveSpy.mockRestore();
    });

    it("detects CPL spike anomaly", async () => {
      const recordSpy = vi
        .spyOn(issueEngine, "recordFindingWithClient")
        .mockResolvedValue({ id: "iss-cpl-1", created: true } as any);
      const resolveSpy = vi
        .spyOn(issueEngine, "resolveFindingScoped")
        .mockResolvedValue(undefined as any);

      const fakePrisma = {
        website: {
          findFirst: vi.fn().mockResolvedValue({ id: "site-1" }),
        },
      } as any;

      const campaign = {
        id: "camp-li",
        name: "LinkedIn InMail",
        channel: "LINKEDIN_ADS",
      };

      const metrics: any = {
        spendCents: 30000, // $300
        conversions: 2, // 2 leads
        costPerLeadCents: 15000, // $150/lead > $120 threshold
        clicks: 80,
        impressions: 500,
        ctrPct: 16.0,
      };

      const result = await detectMarketingAnomalies(
        campaign,
        metrics,
        { organizationId: "org-1", websiteId: "site-1" },
        fakePrisma,
      );

      expect(result.detectedCount).toBe(1);
      expect(recordSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ruleId: "RULE_MARKETING_CPL_SPIKE",
          severity: "HIGH",
        }),
        fakePrisma,
      );

      recordSpy.mockRestore();
      resolveSpy.mockRestore();
    });
  });
});
