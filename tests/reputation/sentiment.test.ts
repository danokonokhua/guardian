import { describe, expect, it } from "vitest";
import {
  analyzeReviewSentiment,
  calculateReputationMetrics,
} from "@/services/reputation/sentiment";

describe("Reputation Sentiment Engine", () => {
  describe("analyzeReviewSentiment", () => {
    it("classifies enthusiastic 5-star review as POSITIVE with high score", () => {
      const result = analyzeReviewSentiment(
        "Great experience! The support team was amazing and super fast.",
        5,
      );

      expect(result.sentiment).toBe("POSITIVE");
      expect(result.sentimentScore).toBeGreaterThanOrEqual(0.8);
      expect(result.keywords).toContain("Customer Service");
      expect(result.keywords).toContain("Speed & Performance");
    });

    it("classifies 4-star review with mild feedback as POSITIVE", () => {
      const result = analyzeReviewSentiment(
        "Solid product and helpful onboarding, but pricing could be better.",
        4,
      );

      expect(result.sentiment).toBe("POSITIVE");
      expect(result.keywords).toContain("Pricing & Billing");
    });

    it("classifies mixed 3-star review as NEUTRAL", () => {
      const result = analyzeReviewSentiment(
        "Service was average, not great but not terrible.",
        3,
      );

      expect(result.sentiment).toBe("NEUTRAL");
    });

    it("classifies 1-star complaint as NEGATIVE with critical themes", () => {
      const result = analyzeReviewSentiment(
        "Worst experience ever. The system was completely broken and down.",
        1,
      );

      expect(result.sentiment).toBe("NEGATIVE");
      expect(result.sentimentScore).toBeLessThanOrEqual(0.3);
      expect(result.keywords).toContain("Reliability");
    });
  });

  describe("calculateReputationMetrics", () => {
    it("computes accurate aggregates, response rate, and keyword counts", () => {
      const sampleReviews = [
        { rating: 5, hasReply: true, sentiment: "POSITIVE", sentimentKeywords: ["Customer Service", "Speed & Performance"] },
        { rating: 5, hasReply: true, sentiment: "POSITIVE", sentimentKeywords: ["Customer Service"] },
        { rating: 4, hasReply: false, sentiment: "POSITIVE", sentimentKeywords: ["Product Quality"] },
        { rating: 1, hasReply: false, sentiment: "NEGATIVE", sentimentKeywords: ["Reliability"] },
      ];

      const metrics = calculateReputationMetrics(sampleReviews as any);

      expect(metrics.totalReviews).toBe(4);
      expect(metrics.averageRating).toBe(3.8); // (5+5+4+1)/4 = 3.75 -> 3.8
      expect(metrics.unansweredReviews).toBe(2);
      expect(metrics.responseRatePercent).toBe(50); // 2/4 = 50%
      expect(metrics.sentimentBreakdown.positivePercent).toBe(75); // 3/4 = 75%
      expect(metrics.sentimentBreakdown.negativePercent).toBe(25); // 1/4 = 25%

      const customerServiceKw = metrics.topKeywords.find((k) => k.tag === "Customer Service");
      expect(customerServiceKw?.count).toBe(2);
    });

    it("returns default healthy metrics for zero reviews", () => {
      const metrics = calculateReputationMetrics([]);
      expect(metrics.totalReviews).toBe(0);
      expect(metrics.averageRating).toBe(5.0);
      expect(metrics.responseRatePercent).toBe(100);
      expect(metrics.sentimentScore).toBe(100);
    });
  });
});
