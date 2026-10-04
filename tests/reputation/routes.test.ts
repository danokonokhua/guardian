import { beforeEach, describe, expect, it, vi } from "vitest";

const { permissionMock, repServiceMock } = vi.hoisted(() => ({
  permissionMock: vi.fn(),
  repServiceMock: {
    getReputationOverview: vi.fn(),
    recordReview: vi.fn(),
    generateAiDraft: vi.fn(),
    submitReviewReply: vi.fn(),
  },
}));

vi.mock("@/lib/auth/context", () => ({
  requirePermission: permissionMock,
}));

vi.mock("@/services/reputation/service", () => repServiceMock);

import {
  GET as getReputationRoute,
  POST as postReputationRoute,
} from "@/app/api/v1/organizations/[organizationId]/reputation/route";

import {
  POST as postResponseRoute,
  PATCH as patchResponseRoute,
} from "@/app/api/v1/organizations/[organizationId]/reputation/reviews/[reviewId]/response/route";

const ORG = "org-111";
const REVIEW_ID = "rev-999";
const context = {
  organizationId: ORG,
  user: { userId: "user-1", email: "admin@example.com" },
  membership: { organizationId: ORG, role: "OWNER" },
};

describe("Reputation API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissionMock.mockResolvedValue(context);
  });

  describe("GET /reputation", () => {
    it("returns reputation metrics and reviews list", async () => {
      repServiceMock.getReputationOverview.mockResolvedValue({
        metrics: { averageRating: 4.8, totalReviews: 10 },
        reviews: [{ id: "r1", authorName: "Marcus" }],
        total: 10,
      });

      const response = await getReputationRoute(
        new Request("https://guardian.test?rating=5&sentiment=POSITIVE"),
        { params: Promise.resolve({ organizationId: ORG }) },
      );

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.metrics.averageRating).toBe(4.8);
      expect(repServiceMock.getReputationOverview).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ rating: 5, sentiment: "POSITIVE" }),
      );
    });
  });

  describe("POST /reputation", () => {
    it("ingests review and returns 201", async () => {
      repServiceMock.recordReview.mockResolvedValue({
        id: "rev-new",
        authorName: "Liam",
        rating: 5,
      });

      const response = await postReputationRoute(
        new Request("https://guardian.test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            authorName: "Liam",
            rating: 5,
            comment: "Exceptional platform!",
          }),
        }),
        { params: Promise.resolve({ organizationId: ORG }) },
      );

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.data.id).toBe("rev-new");
      expect(repServiceMock.recordReview).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ authorName: "Liam", rating: 5 }),
      );
    });
  });

  describe("POST /reviews/[reviewId]/response", () => {
    it("generates AI draft response", async () => {
      repServiceMock.generateAiDraft.mockResolvedValue({
        id: REVIEW_ID,
        aiSuggestedReply: "Hi customer...",
        aiSuggestionStatus: "PENDING_REVIEW",
      });

      const response = await postResponseRoute(
        new Request("https://guardian.test", { method: "POST" }),
        { params: Promise.resolve({ organizationId: ORG, reviewId: REVIEW_ID }) },
      );

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.aiSuggestionStatus).toBe("PENDING_REVIEW");
      expect(repServiceMock.generateAiDraft).toHaveBeenCalledWith(expect.anything(), REVIEW_ID);
    });
  });

  describe("PATCH /reviews/[reviewId]/response", () => {
    it("saves approved reply", async () => {
      repServiceMock.submitReviewReply.mockResolvedValue({
        id: REVIEW_ID,
        hasReply: true,
        replyText: "Approved response text.",
        aiSuggestionStatus: "APPROVED",
      });

      const response = await patchResponseRoute(
        new Request("https://guardian.test", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ replyText: "Approved response text." }),
        }),
        { params: Promise.resolve({ organizationId: ORG, reviewId: REVIEW_ID }) },
      );

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.hasReply).toBe(true);
      expect(repServiceMock.submitReviewReply).toHaveBeenCalledWith(
        expect.anything(),
        REVIEW_ID,
        "Approved response text.",
      );
    });
  });
});
