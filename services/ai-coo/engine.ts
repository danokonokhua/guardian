import type { GeneratedDirective, CrossDomainEvidenceSynthesis } from "./types";

export interface OrganizationTelemetryAggregate {
  websiteId: string;
  hostname: string;
  sslDaysRemaining: number | null;
  uptimePercent: number;
  openIssuesCount: number;
  criticalIssuesCount: number;
  formFailureRate: number; // 0.0 to 1.0
  averageLatencyMs: number;
  missingMetaCount: number;
  starRating: number | null;
  unansweredReviews: number;
  competitorTrafficGap: number; // percentage competitor leads Guardian site
}

/**
 * AI COO Directive Engine: Synthesizes multi-vector telemetry across Website, Leads,
 * Performance, SEO, Security, Reputation, and Competitors into prioritized business roadmaps.
 */
export function synthesizeExecutiveDirectives(
  telemetry: OrganizationTelemetryAggregate,
): GeneratedDirective[] {
  const directives: GeneratedDirective[] = [];

  const crossEvidence: CrossDomainEvidenceSynthesis = {
    websiteVector: {
      hostname: telemetry.hostname,
      uptimePercent: telemetry.uptimePercent,
      unresolvedIssuesCount: telemetry.openIssuesCount,
    },
    revenueVector: {
      formCaptureHealth: telemetry.formFailureRate > 0.1 ? "DEGRADED" : "HEALTHY",
      estimatedRevenueLossMonthly: Math.round(telemetry.formFailureRate * 3500),
    },
    performanceVector: {
      averageResponseTimeMs: telemetry.averageLatencyMs,
      regressionTrend: telemetry.averageLatencyMs > 1200 ? "DEGRADING" : "STABLE",
    },
    seoVector: {
      indexingHealth: telemetry.missingMetaCount > 2 ? "SUBOPTIMAL" : "OPTIMAL",
      metaCoveragePercent: Math.max(0, 100 - telemetry.missingMetaCount * 20),
    },
    securityVector: {
      sslRunwayDays: telemetry.sslDaysRemaining,
      missingHeadersCount: 0,
    },
    reputationVector: {
      averageStarRating: telemetry.starRating ?? 4.5,
      unansweredReviewsCount: telemetry.unansweredReviews,
    },
    competitorVector: {
      trafficSharePercent: Math.max(10, 100 - telemetry.competitorTrafficGap),
      keywordOverlap: "HIGH_INTENT_COMMERCIAL",
    },
  };

  // 1. Critical Revenue Protection Directive (P0)
  if (
    telemetry.formFailureRate > 0.2 ||
    (telemetry.sslDaysRemaining !== null && telemetry.sslDaysRemaining <= 7)
  ) {
    const isSsl = telemetry.sslDaysRemaining !== null && telemetry.sslDaysRemaining <= 7;
    directives.push({
      category: "REVENUE_PROTECTION",
      priorityTier: "P0_IMMEDIATE",
      urgencyScore: 98,
      title: isSsl
        ? `Emergency TLS Renewal Runway (${telemetry.sslDaysRemaining} Days)`
        : "Critical Inbound Lead Funnel Collapse Remediation",
      executiveSummary: isSsl
        ? "Certificate decay cliff within 7 days risks browser blocking 100% of organic traffic and checkout conversions."
        : `Lead form failure rate of ${Math.round(telemetry.formFailureRate * 100)}% is causing an estimated $${crossEvidence.revenueVector?.estimatedRevenueLossMonthly}/mo in lost customer pipeline.`,
      businessImpactUsd: isSsl
        ? 8500
        : (crossEvidence.revenueVector?.estimatedRevenueLossMonthly ?? 3500),
      effortEstimation: "LOW_EFFORT",
      operationalAction: isSsl
        ? "Authorize immediate AutoFix TLS certbot cycle and verify DNS challenge propagation."
        : "Deploy verified form submission handler and test synthetic inquiry submission end-to-end.",
      autoFixAvailable: true,
      crossDomainEvidence: crossEvidence,
    });
  }

  // 2. Conversion Rate & Latency Optimization Directive (P1)
  if (telemetry.averageLatencyMs > 1200 || telemetry.uptimePercent < 99.5) {
    directives.push({
      category: "CONVERSION_RATE",
      priorityTier: "P1_THIS_WEEK",
      urgencyScore: 82,
      title: "Core Web Vitals TTFB & Server Latency Acceleration",
      executiveSummary: `Current TTFB/Response time of ${telemetry.averageLatencyMs}ms exceeds the recommended 800ms threshold. Every 100ms of latency reduction correlates with a 1.2% lift in visitor conversion rates.`,
      businessImpactUsd: 2200,
      effortEstimation: "MODERATE_EFFORT",
      operationalAction:
        "Enable Cloudflare edge caching, compress unoptimized Hero WebP assets, and prune slow database queries.",
      autoFixAvailable: true,
      crossDomainEvidence: crossEvidence,
    });
  }

  // 3. Search Engine Dominance & Meta Optimization Directive (P1/P2)
  if (telemetry.missingMetaCount > 0) {
    directives.push({
      category: "SEO_DOMINANCE",
      priorityTier: "P1_THIS_WEEK",
      urgencyScore: 76,
      title: "Social Preview & Meta Description Deficit Remediation",
      executiveSummary: `${telemetry.missingMetaCount} primary landing pages lack OpenGraph social tags or structured description metadata, reducing CTR in Google SERPs by an estimated 15-25%.`,
      businessImpactUsd: 1800,
      effortEstimation: "LOW_EFFORT",
      operationalAction:
        "Auto-generate Schema.org JSON-LD and meta descriptions across indexable routes.",
      autoFixAvailable: true,
      crossDomainEvidence: crossEvidence,
    });
  }

  // 4. Reputation & Review Engagement Directive (P2)
  if (
    telemetry.unansweredReviews > 0 ||
    (telemetry.starRating !== null && telemetry.starRating < 4.0)
  ) {
    directives.push({
      category: "REPUTATION_SAFEGUARD",
      priorityTier: "P2_THIS_MONTH",
      urgencyScore: 68,
      title: "Customer Review Sentiment & Local SEO Trust Recovery",
      executiveSummary: `${telemetry.unansweredReviews} customer reviews on Google Business Profile remain unanswered. Active responses to reviews improve Google Map pack rankings and consumer trust.`,
      businessImpactUsd: 1400,
      effortEstimation: "LOW_EFFORT",
      operationalAction:
        "Generate and publish empathetic AI responses to pending reviews via Guardian Reputation Hub.",
      autoFixAvailable: false,
      crossDomainEvidence: crossEvidence,
    });
  }

  // 5. Strategic Competitive Outflanking (P3)
  if (telemetry.competitorTrafficGap > 20) {
    directives.push({
      category: "INFRASTRUCTURE_RESILIENCE",
      priorityTier: "P3_STRATEGIC",
      urgencyScore: 55,
      title: "Competitive Gap Closure & Content Moat Construction",
      executiveSummary: `Top competitors currently hold a ${telemetry.competitorTrafficGap}% estimated traffic advantage across core industry keywords.`,
      businessImpactUsd: 4500,
      effortEstimation: "HIGH_EFFORT",
      operationalAction:
        "Target identified competitor keyword gaps and establish authoritative topic cluster landing pages.",
      autoFixAvailable: false,
      crossDomainEvidence: crossEvidence,
    });
  }

  return directives.sort((a, b) => b.urgencyScore - a.urgencyScore);
}
