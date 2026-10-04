export type PredictiveTargetVector =
  | "SSL_EXPIRY"
  | "UPTIME_ANOMALY"
  | "LEAD_COLLAPSE"
  | "PERFORMANCE_DEGRADATION"
  | "SEO_VISIBILITY_DROP"
  | "DNS_HEALTH";

export type PredictiveRiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export type PredictiveWindow = "NEXT_24_HOURS" | "NEXT_7_DAYS" | "NEXT_14_DAYS" | "NEXT_30_DAYS";

export interface ForecastSignal {
  metric: string;
  currentValue: number | string;
  historicalBaseline?: number | string;
  deviationPercentage?: number;
  observedAt: string;
  interpretation: string;
}

export interface GeneratedForecast {
  targetVector: PredictiveTargetVector;
  riskLevel: PredictiveRiskLevel;
  probabilityScore: number; // 0.00 to 1.00
  predictedWindow: PredictiveWindow;
  forecastRunwayDays: number | null;
  title: string;
  predictedImpact: string;
  preventiveAction: string;
  underlyingSignals: ForecastSignal[];
}

export interface PredictiveVectorDefinition {
  vector: PredictiveTargetVector;
  name: string;
  description: string;
  category: "infrastructure" | "revenue" | "growth";
  icon: string;
}

export const PREDICTIVE_VECTORS: PredictiveVectorDefinition[] = [
  {
    vector: "SSL_EXPIRY",
    name: "SSL Certificate Expiry Runway",
    description:
      "Proactively models TLS certificate decay runways and warns before browser security blocks drop conversions.",
    category: "infrastructure",
    icon: "ShieldAlert",
  },
  {
    vector: "UPTIME_ANOMALY",
    name: "Outage & Latency Slope Anomaly",
    description:
      "Detects progressive response latency degradation and server jitter predicting complete service collapse.",
    category: "infrastructure",
    icon: "Activity",
  },
  {
    vector: "LEAD_COLLAPSE",
    name: "Lead & Conversion Dropoff Risk",
    description:
      "Models form submission cadences and identifies conversion funnel collapses before monthly revenue is lost.",
    category: "revenue",
    icon: "TrendingDown",
  },
  {
    vector: "PERFORMANCE_DEGRADATION",
    name: "Core Web Vitals Regression Runway",
    description:
      "Tracks TTFB, LCP, and CLS creep forecasting Google ranking demotions and ad spend efficiency loss.",
    category: "growth",
    icon: "Gauge",
  },
  {
    vector: "SEO_VISIBILITY_DROP",
    name: "Search Visibility Decay Projection",
    description:
      "Analyzes meta regressions, structured data omissions, and heading shifts forecasting organic traffic drops.",
    category: "growth",
    icon: "Search",
  },
  {
    vector: "DNS_HEALTH",
    name: "DNS & Email Deliverability Drift",
    description:
      "Evaluates SPF, DMARC, and nameserver resolution instability predicting spam folder relegation.",
    category: "infrastructure",
    icon: "MailWarning",
  },
];
