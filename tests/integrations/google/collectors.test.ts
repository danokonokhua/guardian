import { describe, expect, it, vi } from "vitest";
import {
  analyzeGA4Metrics,
  detectGA4Anomalies,
} from "@/services/integrations/google/ga4-collector";
import {
  analyzeGSCMetrics,
  detectGSCAnomalies,
} from "@/services/integrations/google/gsc-collector";
import {
  analyzeGBPMetrics,
  detectGBPAnomalies,
} from "@/services/integrations/google/gbp-collector";

describe("Google Collector Analytics & Anomaly Detection", () => {
  const fakePrisma = {
    website: {
      findFirst: vi.fn().mockResolvedValue({ id: "site-1", organizationId: "org-1" }),
    },
    issue: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "issue-1" }),
      update: vi.fn().mockResolvedValue({ id: "issue-1" }),
      upsert: vi
        .fn()
        .mockResolvedValue({ id: "issue-1", createdAt: new Date(), updatedAt: new Date() }),
    },
    issueActivity: {
      create: vi.fn().mockResolvedValue({ id: "act-1" }),
    },
    $executeRaw: vi.fn().mockResolvedValue(1),
  } as any;

  describe("GA4 Collector", () => {
    it("correctly computes positive week-over-week trends", () => {
      const summary = analyzeGA4Metrics({
        currentSessions: 1200,
        previousSessions: 1000,
        activeUsers: 850,
        pageViews: 3400,
        bounceRatePct: 42.1,
        keyConversions: 45,
      });

      expect(summary.sessionChangePct).toBe(20);
      expect(summary.currentSessions).toBe(1200);
      expect(summary.previousSessions).toBe(1000);
    });

    it("detects severe traffic drop anomalies (>30% drop)", async () => {
      const summary = analyzeGA4Metrics({
        currentSessions: 400,
        previousSessions: 1000, // 60% drop
        activeUsers: 250,
        pageViews: 1100,
        bounceRatePct: 58.0,
        keyConversions: 10,
      });

      expect(summary.sessionChangePct).toBe(-60);

      const result = await detectGA4Anomalies(
        summary,
        { organizationId: "org-1", websiteId: "site-1" },
        fakePrisma,
      );

      expect(result.detected).toBe(true);
      expect(fakePrisma.issue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            ruleId: "RULE_GA4_TRAFFIC_DROP",
            severity: "CRITICAL",
          }),
        }),
      );
    });

    it("does not trigger when traffic is stable", async () => {
      const summary = analyzeGA4Metrics({
        currentSessions: 980,
        previousSessions: 1000,
        activeUsers: 720,
        pageViews: 2800,
        bounceRatePct: 40.0,
        keyConversions: 35,
      });

      const result = await detectGA4Anomalies(
        summary,
        { organizationId: "org-1", websiteId: "site-1" },
        fakePrisma,
      );

      expect(result.detected).toBe(false);
    });
  });

  describe("GSC Collector", () => {
    it("computes organic click drops and triggers visibility alert", async () => {
      const summary = analyzeGSCMetrics({
        currentClicks: 50,
        previousClicks: 100, // 50% drop
        impressions: 4200,
        averageCtrPct: 1.2,
        averagePosition: 14.5,
      });

      expect(summary.clickChangePct).toBe(-50);

      const result = await detectGSCAnomalies(
        summary,
        { organizationId: "org-1", websiteId: "site-1" },
        fakePrisma,
      );

      expect(result.detected).toBe(true);
      expect(fakePrisma.issue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            ruleId: "RULE_GSC_SEARCH_VISIBILITY_DROP",
            severity: "HIGH",
          }),
        }),
      );
    });
  });

  describe("GBP Collector", () => {
    it("flags low rating and unanswered reviews", async () => {
      const summary = analyzeGBPMetrics({
        averageRating: 3.4, // below 3.8 critical threshold
        totalReviewCount: 15,
        unansweredReviewsCount: 4,
        reviewsLast30Days: 5,
      });

      expect(summary.ratingHealth).toBe("CRITICAL");

      const result = await detectGBPAnomalies(
        summary,
        { organizationId: "org-1", websiteId: "site-1" },
        fakePrisma,
      );

      expect(result.detected).toBe(true);
      expect(fakePrisma.issue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            ruleId: "RULE_GBP_LOW_RATING",
            severity: "CRITICAL",
          }),
        }),
      );
    });
  });
});
