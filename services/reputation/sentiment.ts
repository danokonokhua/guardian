import "server-only";

export type SentimentClassification = "POSITIVE" | "NEUTRAL" | "NEGATIVE";

export interface SentimentAnalysisResult {
  sentiment: SentimentClassification;
  sentimentScore: number; // 0.0 (very negative) to 1.0 (very positive)
  keywords: string[];
}

export interface ReviewMetricsSummary {
  averageRating: number;
  totalReviews: number;
  unansweredReviews: number;
  responseRatePercent: number;
  sentimentScore: number; // 0 - 100
  sentimentBreakdown: {
    positivePercent: number;
    neutralPercent: number;
    negativePercent: number;
  };
  topKeywords: Array<{ tag: string; count: number }>;
}

const POSITIVE_WORDS = new Set([
  "great",
  "excellent",
  "amazing",
  "outstanding",
  "loved",
  "helpful",
  "fast",
  "reliable",
  "perfect",
  "recommend",
  "superb",
  "friendly",
  "best",
  "smooth",
  "easy",
  "prompt",
  "professional",
  "wonderful",
  "fantastic",
  "awesome",
  "pleased",
  "solid",
  "happy",
  "impressed",
  "quality",
  "exceptional",
]);

const NEGATIVE_WORDS = new Set([
  "terrible",
  "horrible",
  "awful",
  "worst",
  "broken",
  "scam",
  "rude",
  "slow",
  "unresponsive",
  "useless",
  "failed",
  "never",
  "disappointed",
  "fraud",
  "bad",
  "poor",
  "waste",
  "error",
  "bug",
  "annoying",
  "unacceptable",
  "frustrated",
  "hate",
  "garbage",
  "delayed",
  "problem",
]);

const THEMES: Record<string, string[]> = {
  "Customer Service": ["service", "support", "help", "staff", "rep", "agent", "team", "personnel"],
  "Reliability": ["reliable", "reliability", "uptime", "down", "outage", "stable", "crash", "broken"],
  "Speed & Performance": ["fast", "quick", "speed", "slow", "delay", "wait", "responsive", "lag", "latency"],
  "Pricing & Billing": ["price", "pricing", "cost", "expensive", "cheap", "value", "worth", "refund", "charge", "billing"],
  "Product Quality": ["quality", "feature", "easy", "intuitive", "confusing", "simple", "accurate", "accurate"],
};

export function analyzeReviewSentiment(
  comment: string,
  starRating: number,
): SentimentAnalysisResult {
  const normalized = comment.toLowerCase();
  const words = normalized.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);

  let posCount = 0;
  let negCount = 0;

  for (const word of words) {
    if (POSITIVE_WORDS.has(word)) posCount++;
    if (NEGATIVE_WORDS.has(word)) negCount++;
  }

  // Base score from stars (1 -> 0.1, 2 -> 0.3, 3 -> 0.5, 4 -> 0.75, 5 -> 0.95)
  const starBase =
    starRating === 1 ? 0.1 : starRating === 2 ? 0.3 : starRating === 3 ? 0.5 : starRating === 4 ? 0.8 : 0.95;

  // Lexical modifier (-0.2 to +0.2)
  const totalTokens = Math.max(1, posCount + negCount);
  const textPolarity = (posCount - negCount) / totalTokens;
  const lexicalAdjustment = (posCount === 0 && negCount === 0) ? 0 : textPolarity * 0.2;

  const rawScore = Math.max(0, Math.min(1, starBase + lexicalAdjustment));
  const sentimentScore = Math.round(rawScore * 100) / 100;

  let sentiment: SentimentClassification = "NEUTRAL";
  if (sentimentScore >= 0.65 || (starRating >= 4 && negCount === 0)) {
    sentiment = "POSITIVE";
  } else if (sentimentScore <= 0.4 || starRating <= 2 || negCount > posCount + 1) {
    sentiment = "NEGATIVE";
  }

  // Identify matching theme keywords
  const matchedKeywords: string[] = [];
  for (const [category, keywords] of Object.entries(THEMES)) {
    if (keywords.some((kw) => normalized.includes(kw))) {
      matchedKeywords.push(category);
    }
  }

  return {
    sentiment,
    sentimentScore,
    keywords: matchedKeywords,
  };
}

export function calculateReputationMetrics(
  reviews: Array<{
    rating: number;
    hasReply: boolean;
    sentiment: SentimentClassification | string;
    sentimentKeywords?: any;
  }>,
): ReviewMetricsSummary {
  const totalReviews = reviews.length;
  if (totalReviews === 0) {
    return {
      averageRating: 5.0,
      totalReviews: 0,
      unansweredReviews: 0,
      responseRatePercent: 100,
      sentimentScore: 100,
      sentimentBreakdown: { positivePercent: 100, neutralPercent: 0, negativePercent: 0 },
      topKeywords: [],
    };
  }

  const sumRating = reviews.reduce((acc, r) => acc + r.rating, 0);
  const averageRating = Math.round((sumRating / totalReviews) * 10) / 10;

  const unansweredReviews = reviews.filter((r) => !r.hasReply).length;
  const answeredCount = totalReviews - unansweredReviews;
  const responseRatePercent = Math.round((answeredCount / totalReviews) * 100);

  const posCount = reviews.filter((r) => r.sentiment === "POSITIVE").length;
  const negCount = reviews.filter((r) => r.sentiment === "NEGATIVE").length;
  const neuCount = totalReviews - posCount - negCount;

  const positivePercent = Math.round((posCount / totalReviews) * 100);
  const negativePercent = Math.round((negCount / totalReviews) * 100);
  const neutralPercent = Math.max(0, 100 - positivePercent - negativePercent);

  // Overall sentiment score (0 - 100) combining star rating and positive/negative proportion
  const starWeight = (averageRating / 5) * 60; // Up to 60 points
  const positiveBonus = (positivePercent / 100) * 40; // Up to 40 points
  const negativePenalty = (negativePercent / 100) * 30; // Up to 30 penalty
  const rawSentiment = Math.max(0, Math.min(100, starWeight + positiveBonus - negativePenalty));
  const sentimentScore = Math.round(rawSentiment);

  // Keyword frequency aggregation
  const keywordCounts: Record<string, number> = {};
  for (const review of reviews) {
    const kwList = Array.isArray(review.sentimentKeywords)
      ? review.sentimentKeywords
      : [];
    for (const kw of kwList) {
      keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
    }
  }

  const topKeywords = Object.entries(keywordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));

  return {
    averageRating,
    totalReviews,
    unansweredReviews,
    responseRatePercent,
    sentimentScore,
    sentimentBreakdown: {
      positivePercent,
      neutralPercent,
      negativePercent,
    },
    topKeywords,
  };
}
