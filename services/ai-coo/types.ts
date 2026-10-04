export type CooCategory =
  | "REVENUE_PROTECTION"
  | "INFRASTRUCTURE_RESILIENCE"
  | "CONVERSION_RATE"
  | "SEO_DOMINANCE"
  | "REPUTATION_SAFEGUARD";

export type CooPriorityTier = "P0_IMMEDIATE" | "P1_THIS_WEEK" | "P2_THIS_MONTH" | "P3_STRATEGIC";

export type CooEffort = "LOW_EFFORT" | "MODERATE_EFFORT" | "HIGH_EFFORT";

export type CooDirectiveStatus = "PENDING" | "APPROVED" | "EXECUTED" | "DISMISSED";

export interface CrossDomainEvidenceSynthesis {
  websiteVector?: {
    hostname: string;
    uptimePercent: number;
    unresolvedIssuesCount: number;
  };
  revenueVector?: {
    formCaptureHealth: string;
    estimatedRevenueLossMonthly: number;
  };
  performanceVector?: {
    averageResponseTimeMs: number;
    regressionTrend: string;
  };
  seoVector?: {
    indexingHealth: string;
    metaCoveragePercent: number;
  };
  securityVector?: {
    sslRunwayDays: number | null;
    missingHeadersCount: number;
  };
  reputationVector?: {
    averageStarRating: number;
    unansweredReviewsCount: number;
  };
  competitorVector?: {
    trafficSharePercent: number;
    keywordOverlap: string;
  };
}

export interface GeneratedDirective {
  category: CooCategory;
  priorityTier: CooPriorityTier;
  urgencyScore: number; // 0 to 100
  title: string;
  executiveSummary: string;
  businessImpactUsd: number;
  effortEstimation: CooEffort;
  operationalAction: string;
  autoFixAvailable: boolean;
  crossDomainEvidence: CrossDomainEvidenceSynthesis;
}
