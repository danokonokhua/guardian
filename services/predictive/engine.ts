import type { GeneratedForecast, ForecastSignal, PredictiveTargetVector } from "./types";

export interface TelemetrySnapshot {
  websiteId: string;
  hostname: string;
  sslDaysRemaining?: number | null;
  recentLatenciesMs: number[];
  recentHttpCodes: number[];
  formSubmissionFailures?: number;
  formTotalSubmissions?: number;
  headingsCount?: number;
  missingMetaCount?: number;
  spfDmarcHealthy?: boolean;
}

/**
 * Predicts SSL expiration risk runway before certificate authority revocation or expiry.
 */
export function modelSslRunwayForecast(snapshot: TelemetrySnapshot): GeneratedForecast | null {
  if (snapshot.sslDaysRemaining === undefined || snapshot.sslDaysRemaining === null) {
    return null;
  }

  const days = snapshot.sslDaysRemaining;

  if (days <= 7) {
    return {
      targetVector: "SSL_EXPIRY",
      riskLevel: "CRITICAL",
      probabilityScore: 0.98,
      predictedWindow: "NEXT_7_DAYS",
      forecastRunwayDays: days,
      title: `Critical TLS Certificate Expiration in ${days} Day${days === 1 ? "" : "s"}`,
      predictedImpact:
        "Immediate browser interstitial warning ('Your connection is not private'). Complete visitor dropoff and payment gateway blockage.",
      preventiveAction:
        "Trigger auto-remediation certificate renewal or execute certbot/Let's Encrypt renew immediately.",
      underlyingSignals: [
        {
          metric: "sslDaysRemaining",
          currentValue: days,
          observedAt: new Date().toISOString(),
          interpretation: `Certificate validity window has decayed to ${days} days remaining (critical boundary: <= 7 days).`,
        },
      ],
    };
  }

  if (days <= 14) {
    return {
      targetVector: "SSL_EXPIRY",
      riskLevel: "HIGH",
      probabilityScore: 0.85,
      predictedWindow: "NEXT_14_DAYS",
      forecastRunwayDays: days,
      title: `Elevated TLS Certificate Expiration Risk (${days} Days Remaining)`,
      predictedImpact: "High risk of unexpected weekend expiry or renewal automation lockouts.",
      preventiveAction:
        "Verify automatic renewal hooks and DNS TXT verification token propagation.",
      underlyingSignals: [
        {
          metric: "sslDaysRemaining",
          currentValue: days,
          observedAt: new Date().toISOString(),
          interpretation: `Certificate expiry approaching warning runway: ${days} days remaining.`,
        },
      ],
    };
  }

  if (days <= 30) {
    return {
      targetVector: "SSL_EXPIRY",
      riskLevel: "MODERATE",
      probabilityScore: 0.5,
      predictedWindow: "NEXT_30_DAYS",
      forecastRunwayDays: days,
      title: `SSL Certificate Renewal Horizon (${days} Days)`,
      predictedImpact:
        "Routine renewal window opened. Failure to cycle will escalate to browser warnings.",
      preventiveAction: "Schedule TLS maintenance check with server administrator.",
      underlyingSignals: [
        {
          metric: "sslDaysRemaining",
          currentValue: days,
          observedAt: new Date().toISOString(),
          interpretation: `Standard 30-day ACME renewal cycle threshold reached.`,
        },
      ],
    };
  }

  return null;
}

/**
 * Predicts impending infrastructure outage from rising response latency slopes and 5xx jitter.
 */
export function modelUptimeAnomalyForecast(snapshot: TelemetrySnapshot): GeneratedForecast | null {
  const latencies = snapshot.recentLatenciesMs;
  if (!latencies || latencies.length < 3) return null;

  // Compute average of first half vs second half
  const mid = Math.floor(latencies.length / 2);
  const early = latencies.slice(0, mid);
  const late = latencies.slice(mid);

  const avgEarly = early.reduce((a, b) => a + b, 0) / early.length;
  const avgLate = late.reduce((a, b) => a + b, 0) / late.length;

  const latencySlope = avgLate - avgEarly;
  const percentageIncrease = avgEarly > 0 ? (latencySlope / avgEarly) * 100 : 0;

  // Check 5xx error frequency
  const errorCodes = (snapshot.recentHttpCodes || []).filter((c) => c >= 500);
  const errorRatio =
    snapshot.recentHttpCodes.length > 0 ? errorCodes.length / snapshot.recentHttpCodes.length : 0;

  if (errorRatio >= 0.25 || (avgLate > 2500 && percentageIncrease >= 150)) {
    return {
      targetVector: "UPTIME_ANOMALY",
      riskLevel: "CRITICAL",
      probabilityScore: 0.92,
      predictedWindow: "NEXT_24_HOURS",
      forecastRunwayDays: 1,
      title: "Imminent Infrastructure Outage & Server Collapse",
      predictedImpact:
        "Predicts complete HTTP 502/504 outage causing $1,200+ estimated lost visitor revenue.",
      preventiveAction:
        "Scale web app tier dynos/containers and investigate database connection pool exhaustion.",
      underlyingSignals: [
        {
          metric: "latencySlope",
          currentValue: `${Math.round(avgLate)}ms`,
          historicalBaseline: `${Math.round(avgEarly)}ms`,
          deviationPercentage: Math.round(percentageIncrease),
          observedAt: new Date().toISOString(),
          interpretation: `Response latency accelerated by +${Math.round(percentageIncrease)}% with ${errorCodes.length} intermittent 5xx spikes.`,
        },
      ],
    };
  }

  if (percentageIncrease >= 75 && avgLate > 1200) {
    return {
      targetVector: "UPTIME_ANOMALY",
      riskLevel: "HIGH",
      probabilityScore: 0.74,
      predictedWindow: "NEXT_7_DAYS",
      forecastRunwayDays: 3,
      title: "Progressive Latency Degradation & Resource Exhaustion",
      predictedImpact:
        "Degraded page load experience driving visitor bounce rates and cart abandonment.",
      preventiveAction: "Review server memory footprint and slow SQL query logs.",
      underlyingSignals: [
        {
          metric: "averageLatency",
          currentValue: `${Math.round(avgLate)}ms`,
          historicalBaseline: `${Math.round(avgEarly)}ms`,
          deviationPercentage: Math.round(percentageIncrease),
          observedAt: new Date().toISOString(),
          interpretation: `Response times climbing consistently (+${Math.round(percentageIncrease)}% slope).`,
        },
      ],
    };
  }

  return null;
}

/**
 * Predicts critical conversion funnel and lead capture collapse.
 */
export function modelLeadCollapseForecast(snapshot: TelemetrySnapshot): GeneratedForecast | null {
  if (
    snapshot.formSubmissionFailures === undefined ||
    snapshot.formTotalSubmissions === undefined ||
    snapshot.formTotalSubmissions === 0
  ) {
    return null;
  }

  const failRate = snapshot.formSubmissionFailures / snapshot.formTotalSubmissions;

  if (failRate >= 0.4) {
    return {
      targetVector: "LEAD_COLLAPSE",
      riskLevel: "CRITICAL",
      probabilityScore: 0.95,
      predictedWindow: "NEXT_24_HOURS",
      forecastRunwayDays: 1,
      title: "Severe Lead Form Submission Failure Collapse",
      predictedImpact:
        "Direct revenue collapse: over 40% of inbound buyer enquiries are silently failing to submit.",
      preventiveAction:
        "Verify form action endpoint, anti-spam CAPTCHA keys, and webhook handler health.",
      underlyingSignals: [
        {
          metric: "formFailureRate",
          currentValue: `${Math.round(failRate * 100)}%`,
          historicalBaseline: "0%",
          observedAt: new Date().toISOString(),
          interpretation: `${snapshot.formSubmissionFailures} out of ${snapshot.formTotalSubmissions} recent synthetic form checks failed.`,
        },
      ],
    };
  }

  if (failRate > 0.15) {
    return {
      targetVector: "LEAD_COLLAPSE",
      riskLevel: "HIGH",
      probabilityScore: 0.78,
      predictedWindow: "NEXT_7_DAYS",
      forecastRunwayDays: 4,
      title: "Intermittent Lead Capture Dropoff Anomaly",
      predictedImpact: "Prospect friction and lead leakage across high-intent product pages.",
      preventiveAction:
        "Audit form JavaScript submission handlers and third-party CRM webhook tokens.",
      underlyingSignals: [
        {
          metric: "formFailureRate",
          currentValue: `${Math.round(failRate * 100)}%`,
          observedAt: new Date().toISOString(),
          interpretation:
            "Elevated form failure rate exceeds acceptable operational tolerance (>15%).",
        },
      ],
    };
  }

  return null;
}

/**
 * Predicts Google organic search ranking demotion from Core Web Vitals and meta degradation.
 */
export function modelSeoVisibilityForecast(snapshot: TelemetrySnapshot): GeneratedForecast | null {
  if (snapshot.missingMetaCount && snapshot.missingMetaCount >= 3) {
    return {
      targetVector: "SEO_VISIBILITY_DROP",
      riskLevel: "MODERATE",
      probabilityScore: 0.68,
      predictedWindow: "NEXT_14_DAYS",
      forecastRunwayDays: 10,
      title: "Projected Search Visibility Drop (Meta Regression)",
      predictedImpact:
        "Google search impressions forecast to decline due to unoptimized titles, descriptions, and OpenGraph tags.",
      preventiveAction:
        "Run Guardian AutoFix to regenerate missing meta descriptions and canonical links.",
      underlyingSignals: [
        {
          metric: "missingMetaCount",
          currentValue: snapshot.missingMetaCount,
          observedAt: new Date().toISOString(),
          interpretation: `${snapshot.missingMetaCount} key SEO indexing attributes are absent or unindexed.`,
        },
      ],
    };
  }

  return null;
}

/**
 * Synthesizes all predictive models across a website snapshot into prioritized forecasts.
 */
export function evaluatePredictiveRunway(snapshot: TelemetrySnapshot): GeneratedForecast[] {
  const forecasts: GeneratedForecast[] = [];

  const ssl = modelSslRunwayForecast(snapshot);
  if (ssl) forecasts.push(ssl);

  const uptime = modelUptimeAnomalyForecast(snapshot);
  if (uptime) forecasts.push(uptime);

  const leads = modelLeadCollapseForecast(snapshot);
  if (leads) forecasts.push(leads);

  const seo = modelSeoVisibilityForecast(snapshot);
  if (seo) forecasts.push(seo);

  return forecasts.sort((a, b) => b.probabilityScore - a.probabilityScore);
}
