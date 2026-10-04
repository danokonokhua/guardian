import "server-only";

import type { Prisma } from "@prisma/client";
import type { TenantScope } from "@/db/tenant";
import { withTenantTransaction } from "@/db/tenant";

export interface BusinessReviewRecord {
  id: string;
  organizationId: string;
  websiteId: string | null;
  source: string;
  externalId: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
  rating: number;
  comment: string;
  sentiment: string;
  sentimentScore: number;
  sentimentKeywords: Prisma.JsonValue;
  hasReply: boolean;
  replyText: string | null;
  aiSuggestedReply: string | null;
  aiSuggestionStatus: string | null;
  reviewDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const select = {
  id: true,
  organizationId: true,
  websiteId: true,
  source: true,
  externalId: true,
  authorName: true,
  authorAvatarUrl: true,
  rating: true,
  comment: true,
  sentiment: true,
  sentimentScore: true,
  sentimentKeywords: true,
  hasReply: true,
  replyText: true,
  aiSuggestedReply: true,
  aiSuggestionStatus: true,
  reviewDate: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface ReviewFilters {
  rating?: number;
  sentiment?: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  hasReply?: boolean;
  limit?: number;
  offset?: number;
}

export function listReviews(
  scope: TenantScope,
  filters: ReviewFilters = {},
): Promise<{ items: BusinessReviewRecord[]; total: number }> {
  return withTenantTransaction(scope, async (tx) => {
    const where: Prisma.BusinessReviewWhereInput = {
      organizationId: scope.organizationId,
      ...(filters.rating ? { rating: filters.rating } : {}),
      ...(filters.sentiment ? { sentiment: filters.sentiment } : {}),
      ...(filters.hasReply !== undefined ? { hasReply: filters.hasReply } : {}),
    };

    const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
    const offset = Math.max(filters.offset ?? 0, 0);

    const [items, total] = await Promise.all([
      tx.businessReview.findMany({
        where,
        select,
        orderBy: { reviewDate: "desc" },
        take: limit,
        skip: offset,
      }),
      tx.businessReview.count({ where }),
    ]);

    return { items, total };
  });
}

export function findReviewById(
  scope: TenantScope,
  id: string,
): Promise<BusinessReviewRecord | null> {
  return withTenantTransaction(scope, async (tx) =>
    tx.businessReview.findFirst({
      where: { id, organizationId: scope.organizationId },
      select,
    }),
  );
}

export interface UpsertReviewInput {
  websiteId?: string | null;
  source?: string;
  externalId?: string;
  authorName: string;
  authorAvatarUrl?: string;
  rating: number;
  comment: string;
  sentiment: string;
  sentimentScore: number;
  sentimentKeywords?: Prisma.InputJsonValue;
  hasReply?: boolean;
  replyText?: string | null;
  aiSuggestedReply?: string | null;
  aiSuggestionStatus?: string | null;
  reviewDate?: Date;
}

export function upsertReview(
  scope: TenantScope,
  input: UpsertReviewInput,
): Promise<BusinessReviewRecord> {
  return withTenantTransaction(scope, async (tx) => {
    const source = input.source ?? "DIRECT";
    const externalId =
      input.externalId ?? `dir_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    return tx.businessReview.upsert({
      where: {
        organizationId_source_externalId: {
          organizationId: scope.organizationId,
          source,
          externalId,
        },
      },
      create: {
        organizationId: scope.organizationId,
        websiteId: input.websiteId ?? null,
        source,
        externalId,
        authorName: input.authorName,
        authorAvatarUrl: input.authorAvatarUrl ?? null,
        rating: input.rating,
        comment: input.comment,
        sentiment: input.sentiment,
        sentimentScore: input.sentimentScore,
        sentimentKeywords: input.sentimentKeywords,
        hasReply: input.hasReply ?? false,
        replyText: input.replyText ?? null,
        aiSuggestedReply: input.aiSuggestedReply ?? null,
        aiSuggestionStatus: input.aiSuggestionStatus ?? null,
        reviewDate: input.reviewDate ?? new Date(),
      },
      update: {
        authorName: input.authorName,
        authorAvatarUrl: input.authorAvatarUrl ?? null,
        rating: input.rating,
        comment: input.comment,
        sentiment: input.sentiment,
        sentimentScore: input.sentimentScore,
        sentimentKeywords: input.sentimentKeywords,
        hasReply: input.hasReply ?? false,
        replyText: input.replyText ?? null,
        aiSuggestedReply: input.aiSuggestedReply ?? null,
        aiSuggestionStatus: input.aiSuggestionStatus ?? null,
        reviewDate: input.reviewDate ?? new Date(),
      },
      select,
    });
  });
}

export function updateReviewResponse(
  scope: TenantScope,
  id: string,
  data: {
    hasReply?: boolean;
    replyText?: string | null;
    aiSuggestedReply?: string | null;
    aiSuggestionStatus?: string | null;
  },
): Promise<BusinessReviewRecord> {
  return withTenantTransaction(scope, async (tx) =>
    tx.businessReview.update({
      where: { id },
      data,
      select,
    }),
  );
}

export function listAllReviewsForMetrics(scope: TenantScope): Promise<
  Array<{
    rating: number;
    hasReply: boolean;
    sentiment: string;
    sentimentKeywords: Prisma.JsonValue;
  }>
> {
  return withTenantTransaction(scope, async (tx) =>
    tx.businessReview.findMany({
      where: { organizationId: scope.organizationId },
      select: {
        rating: true,
        hasReply: true,
        sentiment: true,
        sentimentKeywords: true,
      },
      orderBy: { reviewDate: "desc" },
      take: 200,
    }),
  );
}
