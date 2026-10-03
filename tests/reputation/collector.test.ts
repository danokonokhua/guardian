import { describe, expect, it, vi } from "vitest";
import { detectReputationAnomalies } from "@/services/reputation/collector";
import * as issueEngine from "@/lib/issue-engine";

describe("Reputation Anomaly Collector", () => {
  it("flags low rating, unanswered backlog, and negative sentiment spike", async () => {
    const recordSpy = vi
      .spyOn(issueEngine, "recordFindingWithClient")
      .mockResolvedValue({ id: "iss-1", created: true });
    const resolveSpy = vi
      .spyOn(issueEngine, "resolveFindingScoped")
      .mockResolvedValue();

    const fakePrisma = {
      website: {
        findFirst: vi.fn().mockResolvedValue({ id: "site-1" }),
      },
    } as any;

    const metrics = {
      averageRating: 3.2, // Below 4.0 -> flags RULE_GBP_LOW_RATING
      totalReviews: 8,
      unansweredReviews: 4, // >= 3 -> flags RULE_GBP_UNANSWERED_REVIEWS
      responseRatePercent: 50,
      sentimentScore: 40,
      sentimentBreakdown: {
        positivePercent: 50,
        neutralPercent: 10,
        negativePercent: 40, // >= 25% -> flags RULE_REPUTATION_NEGATIVE_SENTIMENT_SPIKE
      },
      topKeywords: [{ tag: "Reliability", count: 3 }],
    };

    const result = await detectReputationAnomalies(
      metrics,
      { organizationId: "org-1", websiteId: "site-1" },
      fakePrisma,
    );

    expect(result.detectedCount).toBe(3);
    expect(recordSpy).toHaveBeenCalledTimes(3);

    expect(recordSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        ruleId: "RULE_GBP_LOW_RATING",
        severity: "CRITICAL",
      }),
      fakePrisma,
    );

    expect(recordSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        ruleId: "RULE_GBP_UNANSWERED_REVIEWS",
        severity: "MEDIUM",
      }),
      fakePrisma,
    );

    expect(recordSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        ruleId: "RULE_REPUTATION_NEGATIVE_SENTIMENT_SPIKE",
        severity: "HIGH",
      }),
      fakePrisma,
    );

    recordSpy.mockRestore();
    resolveSpy.mockRestore();
  });

  it("resolves findings when metrics are healthy", async () => {
    const recordSpy = vi.spyOn(issueEngine, "recordFindingWithClient");
    const resolveSpy = vi
      .spyOn(issueEngine, "resolveFindingScoped")
      .mockResolvedValue();

    const fakePrisma = {
      website: {
        findFirst: vi.fn().mockResolvedValue({ id: "site-1" }),
      },
    } as any;

    const healthyMetrics = {
      averageRating: 4.8, // Healthy
      totalReviews: 12,
      unansweredReviews: 0, // Healthy
      responseRatePercent: 100,
      sentimentScore: 92,
      sentimentBreakdown: {
        positivePercent: 90,
        neutralPercent: 10,
        negativePercent: 0, // Healthy
      },
      topKeywords: [{ tag: "Customer Service", count: 6 }],
    };

    const result = await detectReputationAnomalies(
      healthyMetrics,
      { organizationId: "org-1", websiteId: "site-1" },
      fakePrisma,
    );

    expect(result.detectedCount).toBe(0);
    expect(recordSpy).not.toHaveBeenCalled();
    expect(resolveSpy).toHaveBeenCalledTimes(3); // All 3 rules resolved

    recordSpy.mockRestore();
    resolveSpy.mockRestore();
  });
});
