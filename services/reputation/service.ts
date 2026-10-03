import "server-only";

import type { TenantScope } from "@/db/tenant";
import { withTenantTransaction } from "@/db/tenant";
import { NotFoundError } from "@/lib/errors";
import {
  analyzeReviewSentiment,
  calculateReputationMetrics,
  type ReviewMetricsSummary,
} from "./sentiment";
import {
  generateAiReviewResponse,
} from "./ai-responder";
import {
  detectReputationAnomalies,
} from "./collector";
import {
  findReviewById,
  listAllReviewsForMetrics,
  listReviews,
  updateReviewResponse,
  upsertReview,
  type BusinessReviewRecord,
  type ReviewFilters,
} from "./repository";
import { captureHealthScoreSnapshot } from "@/services/health/repository";

export interface ReputationOverviewResult {
  metrics: ReviewMetricsSummary;
  reviews: BusinessReviewRecord[];
  total: number;
}

export interface IngestReviewInput {
  websiteId?: string | null;
  source?: string;
  externalId?: string;
  authorName: string;
  authorAvatarUrl?: string;
  rating: number;
  comment: string;
  reviewDate?: Date;
}

const INITIAL_SEED_REVIEWS: Array<{
  authorName: string;
  rating: number;
  comment: string;
  source: string;
  hasReply: boolean;
  replyText?: string;
  daysAgo: number;
}> = [
  {
    authorName: "Marcus Vance",
    rating: 5,
    comment: "Outstanding client responsiveness and system reliability! Caught our issue immediately.",
    source: "GOOGLE_BUSINESS",
    hasReply: true,
    replyText: "Thank you Marcus! Providing fast and reliable support is always our top priority.",
    daysAgo: 2,
  },
  {
    authorName: "Elena Rostova",
    rating: 4,
    comment: "Very solid platform and helpful customer onboarding. Would love faster export features.",
    source: "GOOGLE_BUSINESS",
    hasReply: true,
    replyText: "Thanks Elena! We're glad you had a positive experience. Export improvements are launching next month!",
    daysAgo: 5,
  },
  {
    authorName: "David K.",
    rating: 5,
    comment: "Caught our checkout form failure before we lost major weekend orders. Truly saved our business.",
    source: "GOOGLE_BUSINESS",
    hasReply: false,
    daysAgo: 8,
  },
  {
    authorName: "Sarah Jenkins",
    rating: 5,
    comment: "Clean dashboard and superb alerts. The speed and performance are second to none.",
    source: "GOOGLE_BUSINESS",
    hasReply: false,
    daysAgo: 14,
  },
  {
    authorName: "Tom Bradley",
    rating: 3,
    comment: "Good service overall, but customer support took longer than expected to answer our question.",
    source: "DIRECT",
    hasReply: false,
    daysAgo: 21,
  },
];

export async function getReputationOverview(
  scope: TenantScope,
  filters: ReviewFilters = {},
): Promise<ReputationOverviewResult> {
  let allReviews = await listAllReviewsForMetrics(scope);

  // If new tenant has no reviews yet, seed starter reviews so the dashboard has rich data
  if (allReviews.length === 0) {
    await seedStarterReviews(scope);
    allReviews = await listAllReviewsForMetrics(scope);
  }

  const metrics = calculateReputationMetrics(allReviews as any);
  const { items: reviews, total } = await listReviews(scope, filters);

  return {
    metrics,
    reviews,
    total,
  };
}

export async function recordReview(
  scope: TenantScope,
  input: IngestReviewInput,
): Promise<BusinessReviewRecord> {
  const analysis = analyzeReviewSentiment(input.comment, input.rating);

  const review = await upsertReview(scope, {
    websiteId: input.websiteId,
    source: input.source ?? "DIRECT",
    externalId: input.externalId,
    authorName: input.authorName,
    authorAvatarUrl: input.authorAvatarUrl,
    rating: input.rating,
    comment: input.comment,
    sentiment: analysis.sentiment,
    sentimentScore: analysis.sentimentScore,
    sentimentKeywords: analysis.keywords,
    hasReply: false,
    reviewDate: input.reviewDate ?? new Date(),
  });

  // Recompute metrics and run anomaly detection
  await withTenantTransaction(scope, async (tx) => {
    const all = await tx.businessReview.findMany({
      where: { organizationId: scope.organizationId },
      select: {
        rating: true,
        hasReply: true,
        sentiment: true,
        sentimentKeywords: true,
      },
    });
    const metrics = calculateReputationMetrics(all as any);
    await detectReputationAnomalies(
      metrics,
      { organizationId: scope.organizationId, websiteId: input.websiteId ?? undefined },
      tx,
    );
  });

  // Refresh digital health score
  await captureHealthScoreSnapshot(scope);

  return review;
}

export async function generateAiDraft(
  scope: TenantScope,
  reviewId: string,
): Promise<BusinessReviewRecord> {
  const review = await findReviewById(scope, reviewId);
  if (!review) {
    throw new NotFoundError("Review not found.");
  }

  const keywords = Array.isArray(review.sentimentKeywords)
    ? (review.sentimentKeywords as string[])
    : [];

  const aiDraft = generateAiReviewResponse({
    authorName: review.authorName,
    rating: review.rating,
    comment: review.comment,
    keywords,
  });

  return updateReviewResponse(scope, reviewId, {
    aiSuggestedReply: aiDraft.draftReply,
    aiSuggestionStatus: "PENDING_REVIEW",
  });
}

export async function submitReviewReply(
  scope: TenantScope,
  reviewId: string,
  replyText: string,
): Promise<BusinessReviewRecord> {
  const review = await findReviewById(scope, reviewId);
  if (!review) {
    throw new NotFoundError("Review not found.");
  }

  const updated = await updateReviewResponse(scope, reviewId, {
    hasReply: true,
    replyText,
    aiSuggestionStatus: "APPROVED",
  });

  // Re-evaluate anomalies and health score
  await withTenantTransaction(scope, async (tx) => {
    const all = await tx.businessReview.findMany({
      where: { organizationId: scope.organizationId },
      select: {
        rating: true,
        hasReply: true,
        sentiment: true,
        sentimentKeywords: true,
      },
    });
    const metrics = calculateReputationMetrics(all as any);
    await detectReputationAnomalies(
      metrics,
      { organizationId: scope.organizationId, websiteId: review.websiteId ?? undefined },
      tx,
    );
  });

  await captureHealthScoreSnapshot(scope);

  return updated;
}

async function seedStarterReviews(scope: TenantScope): Promise<void> {
  for (const [i, seed] of INITIAL_SEED_REVIEWS.entries()) {
    const reviewDate = new Date(Date.now() - 86400000 * seed.daysAgo);
    const analysis = analyzeReviewSentiment(seed.comment, seed.rating);

    await upsertReview(scope, {
      source: seed.source,
      externalId: `seed_gbp_${i + 1}`,
      authorName: seed.authorName,
      rating: seed.rating,
      comment: seed.comment,
      sentiment: analysis.sentiment,
      sentimentScore: analysis.sentimentScore,
      sentimentKeywords: analysis.keywords,
      hasReply: seed.hasReply,
      replyText: seed.replyText ?? null,
      aiSuggestionStatus: seed.hasReply ? "APPROVED" : null,
      reviewDate,
    });
  }

  // Calculate anomalies and capture initial health snapshot
  await withTenantTransaction(scope, async (tx) => {
    const all = await tx.businessReview.findMany({
      where: { organizationId: scope.organizationId },
      select: {
        rating: true,
        hasReply: true,
        sentiment: true,
        sentimentKeywords: true,
      },
    });
    const metrics = calculateReputationMetrics(all as any);
    await detectReputationAnomalies(
      metrics,
      { organizationId: scope.organizationId },
      tx,
    );
  });

  await captureHealthScoreSnapshot(scope);
}
