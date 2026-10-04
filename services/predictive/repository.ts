import "server-only";

import type { TenantScope } from "@/db/tenant";
import { withTenantTransaction } from "@/db/tenant";
import type { PredictiveTargetVector, PredictiveRiskLevel, ForecastSignal } from "./types";

export const predictiveForecastSelect = {
  id: true,
  organizationId: true,
  websiteId: true,
  targetVector: true,
  riskLevel: true,
  probabilityScore: true,
  predictedWindow: true,
  forecastRunwayDays: true,
  title: true,
  predictedImpact: true,
  underlyingSignals: true,
  preventiveAction: true,
  status: true,
  generatedAt: true,
  updatedAt: true,
} as const;

export type PredictiveForecastRecord = {
  id: string;
  organizationId: string;
  websiteId: string | null;
  targetVector: string;
  riskLevel: string;
  probabilityScore: number;
  predictedWindow: string;
  forecastRunwayDays: number | null;
  title: string;
  predictedImpact: string;
  underlyingSignals: unknown;
  preventiveAction: string;
  status: string;
  generatedAt: Date;
  updatedAt: Date;
};

export async function listPredictiveForecastsByOrg(
  scope: TenantScope,
  filters?: {
    websiteId?: string;
    targetVector?: PredictiveTargetVector;
    riskLevel?: PredictiveRiskLevel;
    status?: string;
  },
): Promise<PredictiveForecastRecord[]> {
  return withTenantTransaction(scope, async (tx) => {
    const where: any = { organizationId: scope.organizationId };
    if (filters?.websiteId) where.websiteId = filters.websiteId;
    if (filters?.targetVector) where.targetVector = filters.targetVector;
    if (filters?.riskLevel) where.riskLevel = filters.riskLevel;
    if (filters?.status) where.status = filters.status;

    return tx.predictiveForecast.findMany({
      where,
      select: predictiveForecastSelect,
      orderBy: [{ probabilityScore: "desc" }, { generatedAt: "desc" }],
    });
  });
}

export async function findPredictiveForecastById(
  scope: TenantScope,
  id: string,
): Promise<PredictiveForecastRecord | null> {
  return withTenantTransaction(scope, async (tx) =>
    tx.predictiveForecast.findFirst({
      where: { id, organizationId: scope.organizationId },
      select: predictiveForecastSelect,
    }),
  );
}

export async function createPredictiveForecastRecord(
  scope: TenantScope,
  data: {
    websiteId?: string | null;
    targetVector: PredictiveTargetVector;
    riskLevel: PredictiveRiskLevel;
    probabilityScore: number;
    predictedWindow: string;
    forecastRunwayDays?: number | null;
    title: string;
    predictedImpact: string;
    underlyingSignals: ForecastSignal[];
    preventiveAction: string;
  },
): Promise<PredictiveForecastRecord> {
  return withTenantTransaction(scope, async (tx) =>
    tx.predictiveForecast.create({
      data: {
        organizationId: scope.organizationId,
        websiteId: data.websiteId,
        targetVector: data.targetVector,
        riskLevel: data.riskLevel,
        probabilityScore: data.probabilityScore,
        predictedWindow: data.predictedWindow,
        forecastRunwayDays: data.forecastRunwayDays,
        title: data.title,
        predictedImpact: data.predictedImpact,
        underlyingSignals: data.underlyingSignals as any,
        preventiveAction: data.preventiveAction,
        status: "ACTIVE",
      },
      select: predictiveForecastSelect,
    }),
  );
}

export async function updatePredictiveForecastStatus(
  scope: TenantScope,
  id: string,
  status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED",
): Promise<PredictiveForecastRecord> {
  return withTenantTransaction(scope, async (tx) =>
    tx.predictiveForecast.update({
      where: { id },
      data: { status },
      select: predictiveForecastSelect,
    }),
  );
}

export async function purgeStaleForecasts(
  scope: TenantScope,
  olderThanDays: number = 30,
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);
  return withTenantTransaction(scope, async (tx) => {
    const result = await tx.predictiveForecast.deleteMany({
      where: {
        organizationId: scope.organizationId,
        generatedAt: { lt: cutoff },
      },
    });
    return result.count;
  });
}
