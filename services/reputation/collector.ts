import "server-only";

import type { Prisma } from "@prisma/client";
import {
  recordFindingWithClient,
  resolveFindingScoped,
  issueFingerprint,
} from "@/lib/issue-engine";
import type { ReviewMetricsSummary } from "./sentiment";

export interface ReputationAnomalyResult {
  detectedCount: number;
  resolvedCount: number;
  issueIds: string[];
}

export async function detectReputationAnomalies(
  metrics: ReviewMetricsSummary,
  context: { organizationId: string; websiteId?: string },
  prisma: Pick<Prisma.TransactionClient, "website" | "issue" | "issueActivity" | "$executeRaw">,
): Promise<ReputationAnomalyResult> {
  let detectedCount = 0;
  let resolvedCount = 0;
  const issueIds: string[] = [];

  const { organizationId } = context;

  // Resolve target website if not provided
  let websiteId = context.websiteId;
  if (!websiteId) {
    const defaultSite = await prisma.website.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!defaultSite) return { detectedCount: 0, resolvedCount: 0, issueIds: [] };
    websiteId = defaultSite.id;
  }

  // 1. Rule 1: Average Rating Below 4.0
  if (metrics.averageRating < 4.0 && metrics.totalReviews >= 4) {
    const isCritical = metrics.averageRating < 3.5;
    const finding = await recordFindingWithClient(
      {
        organizationId,
        websiteId,
        ruleId: "RULE_GBP_LOW_RATING",
        subjectKey: "reputation-low-rating",
        severity: isCritical ? "CRITICAL" : "HIGH",
        title: `Customer Rating Warning: ${metrics.averageRating} / 5.0 across ${metrics.totalReviews} reviews`,
        summary: `Average customer rating is at ${metrics.averageRating}, which is below the 4.0 trust threshold for local search and consumer confidence.`,
        businessImpact:
          "Google Maps and Local 3-Pack placement heavily prioritize businesses rated 4.0+. Ratings below 4.0 typically suffer a 50%+ reduction in inbound inquiries and trust.",
        impactConfidence: 0.9,
        recommendedAction:
          "Review recent negative customer feedback, respond constructively with remediation offers, and trigger a satisfaction campaign to happy clients.",
        technicalEvidence: {
          averageRating: metrics.averageRating,
          totalReviews: metrics.totalReviews,
          sentimentScore: metrics.sentimentScore,
        },
      },
      prisma,
    );
    detectedCount++;
    issueIds.push(finding.id);
  } else {
    const fp = issueFingerprint({
      ruleId: "RULE_GBP_LOW_RATING",
      websiteId,
      subjectKey: "reputation-low-rating",
    });
    await resolveFindingScoped({ organizationId }, fp, prisma as any);
    resolvedCount++;
  }

  // 2. Rule 2: Unanswered Review Backlog
  if (metrics.unansweredReviews >= 3) {
    const finding = await recordFindingWithClient(
      {
        organizationId,
        websiteId,
        ruleId: "RULE_GBP_UNANSWERED_REVIEWS",
        subjectKey: "reputation-unanswered-reviews",
        severity: "MEDIUM",
        title: `Reputation Backlog: ${metrics.unansweredReviews} customer reviews awaiting response`,
        summary: `${metrics.unansweredReviews} reviews have received no owner reply. Current response rate is ${metrics.responseRatePercent}%.`,
        businessImpact:
          "Consumers expect businesses to acknowledge feedback within 24-48 hours. Unanswered negative reviews leave public complaints unaddressed.",
        impactConfidence: 0.8,
        recommendedAction:
          "Open the Reputation dashboard and use the AI response assistant to draft and approve replies to all pending reviews.",
        technicalEvidence: {
          unansweredReviews: metrics.unansweredReviews,
          responseRatePercent: metrics.responseRatePercent,
        },
      },
      prisma,
    );
    detectedCount++;
    issueIds.push(finding.id);
  } else {
    const fp = issueFingerprint({
      ruleId: "RULE_GBP_UNANSWERED_REVIEWS",
      websiteId,
      subjectKey: "reputation-unanswered-reviews",
    });
    await resolveFindingScoped({ organizationId }, fp, prisma as any);
    resolvedCount++;
  }

  // 3. Rule 3: Negative Sentiment Spike
  if (metrics.sentimentBreakdown.negativePercent >= 25 && metrics.totalReviews >= 4) {
    const finding = await recordFindingWithClient(
      {
        organizationId,
        websiteId,
        ruleId: "RULE_REPUTATION_NEGATIVE_SENTIMENT_SPIKE",
        subjectKey: "reputation-negative-sentiment-spike",
        severity: "HIGH",
        title: `Negative Sentiment Spike: ${metrics.sentimentBreakdown.negativePercent}% of reviews are critical`,
        summary: `Over one-quarter of customer reviews reflect negative sentiment. Top negative themes: ${metrics.topKeywords.map((k) => k.tag).join(", ") || "General Service"}.`,
        businessImpact:
          "Clusters of negative reviews signal an acute service breakdown or technical failure that immediately suppresses conversion rates on the website.",
        impactConfidence: 0.88,
        recommendedAction:
          "Analyze the recurring themes in critical reviews and resolve underlying operational bottlenecks.",
        technicalEvidence: {
          sentimentBreakdown: metrics.sentimentBreakdown,
          topKeywords: metrics.topKeywords,
        },
      },
      prisma,
    );
    detectedCount++;
    issueIds.push(finding.id);
  } else {
    const fp = issueFingerprint({
      ruleId: "RULE_REPUTATION_NEGATIVE_SENTIMENT_SPIKE",
      websiteId,
      subjectKey: "reputation-negative-sentiment-spike",
    });
    await resolveFindingScoped({ organizationId }, fp, prisma as any);
    resolvedCount++;
  }

  return { detectedCount, resolvedCount, issueIds };
}
