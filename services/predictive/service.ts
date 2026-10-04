import "server-only";

import type { TenantScope } from "@/db/tenant";
import { withTenantTransaction } from "@/db/tenant";
import { assertCanUsePredictiveIntelligence } from "@/lib/billing/entitlements";
import { NotFoundError } from "@/lib/errors";
import {
  evaluatePredictiveRunway,
  type TelemetrySnapshot,
} from "./engine";
import {
  listPredictiveForecastsByOrg,
  findPredictiveForecastById,
  createPredictiveForecastRecord,
  updatePredictiveForecastStatus,
  purgeStaleForecasts,
  type PredictiveForecastRecord,
} from "./repository";
import type {
  PredictiveTargetVector,
  PredictiveRiskLevel,
} from "./types";

export interface PredictiveOverview {
  totalForecasts: number;
  criticalCount: number;
  highCount: number;
  moderateCount: number;
  projectedRevenueRiskUsd: number;
  forecasts: PredictiveForecastRecord[];
}

/**
 * Lists active predictive intelligence forecasts with summary threat rollups.
 */
export async function getPredictiveOverview(
  scope: TenantScope,
  planId?: string
): Promise<PredictiveOverview> {
  const forecasts = await listPredictiveForecastsByOrg(scope, {
    status: "ACTIVE",
  });

  const criticalCount = forecasts.filter((f) => f.riskLevel === "CRITICAL").length;
  const highCount = forecasts.filter((f) => f.riskLevel === "HIGH").length;
  const moderateCount = forecasts.filter((f) => f.riskLevel === "MODERATE").length;

  // Approximate modeled risk exposure based on probability weights
  const projectedRevenueRiskUsd =
    criticalCount * 1250 + highCount * 450 + moderateCount * 150;

  return {
    totalForecasts: forecasts.length,
    criticalCount,
    highCount,
    moderateCount,
    projectedRevenueRiskUsd,
    forecasts,
  };
}

/**
 * Runs predictive analysis over an organization's websites and persists new risk projections.
 */
export async function generatePredictiveForecastsForOrg(
  scope: TenantScope,
  planId?: string
): Promise<{
  websitesAnalyzed: number;
  newForecastsGenerated: number;
}> {
  let effectivePlan = planId;
  if (!effectivePlan) {
    const org = await withTenantTransaction(scope, async (tx) =>
      tx.organization.findUnique({
        where: { id: scope.organizationId },
        select: { plan: true },
      })
    );
    effectivePlan = org?.plan ?? "PRO";
  }

  assertCanUsePredictiveIntelligence(effectivePlan);

  // Fetch websites and recent telemetry for the tenant
  const websites = await withTenantTransaction(scope, async (tx) =>
    tx.website.findMany({
      where: { organizationId: scope.organizationId, deletedAt: null },
      include: {
        monitors: {
          include: {
            results: {
              take: 10,
              orderBy: { checkedAt: "desc" },
            },
          },
        },
      },
    })
  );

  let newForecastsCount = 0;

  for (const site of websites) {
    // Extract telemetry signals
    let sslDays: number | null = null;
    const latencies: number[] = [];
    const httpCodes: number[] = [];
    let formFailures = 0;
    let formTotal = 0;

    for (const monitor of site.monitors) {
      if (monitor.type === "SSL") {
        const latest = monitor.results[0];
        if (latest?.details && typeof latest.details === "object") {
          const det = latest.details as Record<string, any>;
          if (typeof det.daysRemaining === "number") {
            sslDays = det.daysRemaining;
          }
        }
      }

      if (monitor.type === "UPTIME" || monitor.type === "PERFORMANCE") {
        for (const res of monitor.results) {
          if (res.responseTimeMs !== null) latencies.push(res.responseTimeMs);
          if (res.httpStatusCode !== null) httpCodes.push(res.httpStatusCode);
        }
      }

      if (monitor.type === "FORM") {
        for (const res of monitor.results) {
          formTotal++;
          if (res.status === "ERROR" || res.status === "DOWN") {
            formFailures++;
          }
        }
      }
    }

    const snapshot: TelemetrySnapshot = {
      websiteId: site.id,
      hostname: site.hostname,
      sslDaysRemaining: sslDays,
      recentLatenciesMs: latencies,
      recentHttpCodes: httpCodes,
      formSubmissionFailures: formTotal > 0 ? formFailures : undefined,
      formTotalSubmissions: formTotal > 0 ? formTotal : undefined,
    };

    const modeled = evaluatePredictiveRunway(snapshot);

    for (const forecast of modeled) {
      await createPredictiveForecastRecord(scope, {
        websiteId: site.id,
        targetVector: forecast.targetVector,
        riskLevel: forecast.riskLevel,
        probabilityScore: forecast.probabilityScore,
        predictedWindow: forecast.predictedWindow,
        forecastRunwayDays: forecast.forecastRunwayDays,
        title: forecast.title,
        predictedImpact: forecast.predictedImpact,
        underlyingSignals: forecast.underlyingSignals,
        preventiveAction: forecast.preventiveAction,
      });
      newForecastsCount++;
    }
  }

  return {
    websitesAnalyzed: websites.length,
    newForecastsGenerated: newForecastsCount,
  };
}

/**
 * Updates a forecast status (e.g. ACKNOWLEDGED, RESOLVED, DISMISSED).
 */
export async function acknowledgeForecast(
  scope: TenantScope,
  id: string,
  status: "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED" = "ACKNOWLEDGED"
): Promise<PredictiveForecastRecord> {
  const existing = await findPredictiveForecastById(scope, id);
  if (!existing) {
    throw new NotFoundError("Predictive forecast not found.");
  }

  return updatePredictiveForecastStatus(scope, id, status);
}
