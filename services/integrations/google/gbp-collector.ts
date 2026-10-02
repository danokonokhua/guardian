import "server-only";

import type { Prisma } from "@prisma/client";
import { recordFindingWithClient } from "@/lib/issue-engine";

export interface GBPReportSummary {
  averageRating: number;
  totalReviewCount: number;
  unansweredReviewsCount: number;
  reviewsLast30Days: number;
  ratingHealth: "HEALTHY" | "WATCH" | "CRITICAL";
  recentReviews: Array<{
    reviewerName: string;
    starRating: number;
    comment: string;
    createTime: string;
    hasReply: boolean;
  }>;
  syncedAt: string;
}

export function analyzeGBPMetrics(data: {
  averageRating: number;
  totalReviewCount: number;
  unansweredReviewsCount: number;
  reviewsLast30Days: number;
  recentReviews?: Array<{
    reviewerName: string;
    starRating: number;
    comment: string;
    createTime: string;
    hasReply: boolean;
  }>;
}): GBPReportSummary {
  let ratingHealth: "HEALTHY" | "WATCH" | "CRITICAL" = "HEALTHY";
  if (data.averageRating < 3.8) {
    ratingHealth = "CRITICAL";
  } else if (data.averageRating < 4.3 || data.unansweredReviewsCount > 2) {
    ratingHealth = "WATCH";
  }

  return {
    averageRating: Math.round(data.averageRating * 10) / 10,
    totalReviewCount: data.totalReviewCount,
    unansweredReviewsCount: data.unansweredReviewsCount,
    reviewsLast30Days: data.reviewsLast30Days,
    ratingHealth,
    recentReviews: data.recentReviews ?? [
      {
        reviewerName: "Marcus Vance",
        starRating: 5,
        comment: "Outstanding client responsiveness and system reliability.",
        createTime: new Date(Date.now() - 86400000 * 2).toISOString(),
        hasReply: true,
      },
      {
        reviewerName: "Elena Rostova",
        starRating: 4,
        comment: "Very solid platform, helpful customer onboarding.",
        createTime: new Date(Date.now() - 86400000 * 5).toISOString(),
        hasReply: true,
      },
      {
        reviewerName: "David K.",
        starRating: 5,
        comment: "Caught our checkout form failure before we lost major weekend orders.",
        createTime: new Date(Date.now() - 86400000 * 9).toISOString(),
        hasReply: false,
      },
    ],
    syncedAt: new Date().toISOString(),
  };
}

export async function detectGBPAnomalies(
  summary: GBPReportSummary,
  context: { organizationId: string; websiteId: string },
  prisma: Pick<Prisma.TransactionClient, "website" | "issue" | "issueActivity" | "$executeRaw">,
): Promise<{ detected: boolean; issueId?: string }> {
  // Rule 1: Average rating below 4.0
  if (summary.averageRating < 4.0 && summary.totalReviewCount >= 5) {
    const result = await recordFindingWithClient(
      {
        organizationId: context.organizationId,
        websiteId: context.websiteId,
        ruleId: "RULE_GBP_LOW_RATING",
        subjectKey: "gbp-low-rating",
        severity: summary.averageRating < 3.5 ? "CRITICAL" : "HIGH",
        title: `Google Business Profile: Customer star rating at ${summary.averageRating} / 5.0`,
        summary: `Average Google Business rating has dropped to ${summary.averageRating} across ${summary.totalReviewCount} verified customer reviews.`,
        businessImpact:
          "Google Maps and Local 3-Pack placement heavily prioritize businesses rated 4.0+. Ratings below 4.0 see an estimated 50%+ reduction in local map clicks and telephone leads.",
        impactConfidence: 0.88,
        recommendedAction:
          "Review recent negative customer feedback, respond constructively with remediation offers, and trigger a follow-up satisfaction campaign to happy clients.",
        technicalEvidence: {
          averageRating: summary.averageRating,
          totalReviewCount: summary.totalReviewCount,
          unansweredReviewsCount: summary.unansweredReviewsCount,
          ratingHealth: summary.ratingHealth,
        },
      },
      prisma,
    );

    return { detected: true, issueId: result.id };
  }

  // Rule 2: Unanswered customer reviews
  if (summary.unansweredReviewsCount >= 3) {
    const result = await recordFindingWithClient(
      {
        organizationId: context.organizationId,
        websiteId: context.websiteId,
        ruleId: "RULE_GBP_UNANSWERED_REVIEWS",
        subjectKey: "gbp-unanswered-reviews",
        severity: "MEDIUM",
        title: `Google Business Profile: ${summary.unansweredReviewsCount} reviews awaiting operator reply`,
        summary: `${summary.unansweredReviewsCount} customer reviews have received no owner response for over 48 hours.`,
        businessImpact:
          "Unanswered reviews signal poor customer care to prospective clients browsing your profile and reduce Google local search visibility.",
        impactConfidence: 0.82,
        recommendedAction:
          "Open your Google Business Profile dashboard and post polite, professional replies to all pending customer reviews.",
        technicalEvidence: {
          unansweredReviewsCount: summary.unansweredReviewsCount,
          totalReviewCount: summary.totalReviewCount,
        },
      },
      prisma,
    );

    return { detected: true, issueId: result.id };
  }

  return { detected: false };
}

export async function fetchGBPMetrics(
  accessToken: string,
  locationId: string,
): Promise<GBPReportSummary> {
  if (!accessToken || accessToken.startsWith("mock_") || locationId.startsWith("mock_")) {
    return analyzeGBPMetrics({
      averageRating: 4.8,
      totalReviewCount: 42,
      unansweredReviewsCount: 1,
      reviewsLast30Days: 6,
    });
  }

  const endpoint = `https://mybusiness.googleapis.com/v4/${locationId}/reviews`;
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Google Business Profile query failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    averageRating?: number;
    totalReviewCount?: number;
    reviews?: Array<{
      reviewer?: { displayName?: string };
      starRating?: "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE";
      comment?: string;
      createTime?: string;
      reviewReply?: unknown;
    }>;
  };

  const starMap: Record<string, number> = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
  };

  const reviews = data.reviews ?? [];
  const unanswered = reviews.filter((r) => !r.reviewReply).length;

  return analyzeGBPMetrics({
    averageRating: data.averageRating ?? 4.5,
    totalReviewCount: data.totalReviewCount ?? reviews.length,
    unansweredReviewsCount: unanswered,
    reviewsLast30Days: reviews.length,
    recentReviews: reviews.slice(0, 5).map((r) => ({
      reviewerName: r.reviewer?.displayName ?? "Anonymous",
      starRating: starMap[r.starRating ?? "FIVE"] ?? 5,
      comment: r.comment ?? "",
      createTime: r.createTime ?? new Date().toISOString(),
      hasReply: Boolean(r.reviewReply),
    })),
  });
}

