import { describe, expect, it, vi, beforeEach } from "vitest";
import * as tenantDb from "@/db/tenant";
import * as repRepo from "@/services/reputation/repository";
import * as repCollector from "@/services/reputation/collector";
import * as healthRepo from "@/services/health/repository";
import {
  recordReview,
  generateAiDraft,
  submitReviewReply,
  getReputationOverview,
} from "@/services/reputation/service";
import { NotFoundError } from "@/lib/errors";

describe("Reputation Service", () => {
  const scope: tenantDb.TenantScope = {
    organizationId: "org-1",
    userId: "user-1",
    role: "OWNER",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(healthRepo, "captureHealthScoreSnapshot").mockResolvedValue({} as any);
  });

  describe("recordReview", () => {
    it("ingests review, runs sentiment analysis, updates anomalies, and refreshes health score", async () => {
      const fakeReview = {
        id: "rev-1",
        authorName: "Marcus Vance",
        rating: 5,
        comment: "Outstanding client service!",
        sentiment: "POSITIVE",
        sentimentScore: 0.95,
      };

      vi.spyOn(repRepo, "upsertReview").mockResolvedValue(fakeReview as any);

      const mockTx = {
        businessReview: {
          findMany: vi.fn().mockResolvedValue([fakeReview]),
        },
      };

      vi.spyOn(tenantDb, "withTenantTransaction").mockImplementation(async (_scope, callback) => {
        return callback(mockTx as any);
      });

      const anomalySpy = vi
        .spyOn(repCollector, "detectReputationAnomalies")
        .mockResolvedValue({ detectedCount: 0, resolvedCount: 0, issueIds: [] });

      const result = await recordReview(scope, {
        authorName: "Marcus Vance",
        rating: 5,
        comment: "Outstanding client service!",
      });

      expect(result.id).toBe("rev-1");
      expect(repRepo.upsertReview).toHaveBeenCalledWith(
        scope,
        expect.objectContaining({
          sentiment: "POSITIVE",
          authorName: "Marcus Vance",
        }),
      );
      expect(anomalySpy).toHaveBeenCalled();
      expect(healthRepo.captureHealthScoreSnapshot).toHaveBeenCalledWith(scope);
    });
  });

  describe("generateAiDraft", () => {
    it("creates an AI response draft in PENDING_REVIEW status", async () => {
      const fakeReview = {
        id: "rev-1",
        authorName: "Elena Rostova",
        rating: 4,
        comment: "Great experience with support team.",
        sentimentKeywords: ["Customer Service"],
      };

      vi.spyOn(repRepo, "findReviewById").mockResolvedValue(fakeReview as any);
      vi.spyOn(repRepo, "updateReviewResponse").mockResolvedValue({
        ...fakeReview,
        aiSuggestedReply: "Hi Elena...",
        aiSuggestionStatus: "PENDING_REVIEW",
      } as any);

      const result = await generateAiDraft(scope, "rev-1");

      expect(repRepo.updateReviewResponse).toHaveBeenCalledWith(
        scope,
        "rev-1",
        expect.objectContaining({
          aiSuggestionStatus: "PENDING_REVIEW",
          aiSuggestedReply: expect.stringContaining("Hi Elena"),
        }),
      );
      expect(result.aiSuggestionStatus).toBe("PENDING_REVIEW");
    });

    it("throws NotFoundError if review does not exist", async () => {
      vi.spyOn(repRepo, "findReviewById").mockResolvedValue(null);

      await expect(generateAiDraft(scope, "missing-rev")).rejects.toThrow(NotFoundError);
    });
  });

  describe("submitReviewReply", () => {
    it("approves and marks review as answered and refreshes score", async () => {
      const fakeReview = {
        id: "rev-1",
        hasReply: false,
        websiteId: "site-1",
      };

      vi.spyOn(repRepo, "findReviewById").mockResolvedValue(fakeReview as any);
      vi.spyOn(repRepo, "updateReviewResponse").mockResolvedValue({
        ...fakeReview,
        hasReply: true,
        replyText: "Thank you for the review!",
        aiSuggestionStatus: "APPROVED",
      } as any);

      const mockTx = {
        businessReview: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      };

      vi.spyOn(tenantDb, "withTenantTransaction").mockImplementation(async (_scope, callback) => {
        return callback(mockTx as any);
      });

      vi.spyOn(repCollector, "detectReputationAnomalies").mockResolvedValue({
        detectedCount: 0,
        resolvedCount: 1,
        issueIds: [],
      });

      const result = await submitReviewReply(
        scope,
        "rev-1",
        "Thank you for the review!",
      );

      expect(result.hasReply).toBe(true);
      expect(result.aiSuggestionStatus).toBe("APPROVED");
      expect(healthRepo.captureHealthScoreSnapshot).toHaveBeenCalledWith(scope);
    });
  });

  describe("getReputationOverview", () => {
    it("returns metrics and reviews", async () => {
      const sampleReviews = [
        { rating: 5, hasReply: true, sentiment: "POSITIVE", sentimentKeywords: [] },
      ];

      vi.spyOn(repRepo, "listAllReviewsForMetrics").mockResolvedValue(sampleReviews as any);
      vi.spyOn(repRepo, "listReviews").mockResolvedValue({
        items: [{ id: "r1", authorName: "Tester" }] as any,
        total: 1,
      });

      const result = await getReputationOverview(scope);

      expect(result.metrics.totalReviews).toBe(1);
      expect(result.metrics.averageRating).toBe(5);
      expect(result.reviews.length).toBe(1);
    });
  });
});
