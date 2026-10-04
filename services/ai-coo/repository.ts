import "server-only";

import type { TenantScope } from "@/db/tenant";
import { withTenantTransaction } from "@/db/tenant";
import type { CooCategory, CooPriorityTier, CooDirectiveStatus, GeneratedDirective } from "./types";

export const cooDirectiveSelect = {
  id: true,
  organizationId: true,
  websiteId: true,
  category: true,
  priorityTier: true,
  urgencyScore: true,
  title: true,
  executiveSummary: true,
  businessImpactUsd: true,
  effortEstimation: true,
  crossDomainEvidence: true,
  operationalAction: true,
  autoFixAvailable: true,
  status: true,
  approvedById: true,
  approvedAt: true,
  executedAt: true,
  executionResult: true,
  generatedAt: true,
  updatedAt: true,
} as const;

export type CooDirectiveRecord = {
  id: string;
  organizationId: string;
  websiteId: string | null;
  category: string;
  priorityTier: string;
  urgencyScore: number;
  title: string;
  executiveSummary: string;
  businessImpactUsd: number;
  effortEstimation: string;
  crossDomainEvidence: unknown;
  operationalAction: string;
  autoFixAvailable: boolean;
  status: string;
  approvedById: string | null;
  approvedAt: Date | null;
  executedAt: Date | null;
  executionResult: unknown;
  generatedAt: Date;
  updatedAt: Date;
};

export async function listCooDirectivesByOrg(
  scope: TenantScope,
  filters?: {
    category?: CooCategory;
    priorityTier?: CooPriorityTier;
    status?: CooDirectiveStatus;
  },
): Promise<CooDirectiveRecord[]> {
  return withTenantTransaction(scope, async (tx) => {
    const where: any = { organizationId: scope.organizationId };
    if (filters?.category) where.category = filters.category;
    if (filters?.priorityTier) where.priorityTier = filters.priorityTier;
    if (filters?.status) where.status = filters.status;

    return tx.cooDirective.findMany({
      where,
      select: cooDirectiveSelect,
      orderBy: [{ urgencyScore: "desc" }, { businessImpactUsd: "desc" }],
    });
  });
}

export async function findCooDirectiveById(
  scope: TenantScope,
  id: string,
): Promise<CooDirectiveRecord | null> {
  return withTenantTransaction(scope, async (tx) =>
    tx.cooDirective.findFirst({
      where: { id, organizationId: scope.organizationId },
      select: cooDirectiveSelect,
    }),
  );
}

export async function createCooDirectiveRecord(
  scope: TenantScope,
  websiteId: string | null,
  data: GeneratedDirective,
): Promise<CooDirectiveRecord> {
  return withTenantTransaction(scope, async (tx) =>
    tx.cooDirective.create({
      data: {
        organizationId: scope.organizationId,
        websiteId,
        category: data.category,
        priorityTier: data.priorityTier,
        urgencyScore: data.urgencyScore,
        title: data.title,
        executiveSummary: data.executiveSummary,
        businessImpactUsd: data.businessImpactUsd,
        effortEstimation: data.effortEstimation,
        crossDomainEvidence: data.crossDomainEvidence as any,
        operationalAction: data.operationalAction,
        autoFixAvailable: data.autoFixAvailable,
        status: "PENDING",
      },
      select: cooDirectiveSelect,
    }),
  );
}

export async function updateCooDirectiveStatusRecord(
  scope: TenantScope,
  id: string,
  update: {
    status: CooDirectiveStatus;
    approvedById?: string | null;
    approvedAt?: Date | null;
    executedAt?: Date | null;
    executionResult?: Record<string, unknown>;
  },
): Promise<CooDirectiveRecord> {
  return withTenantTransaction(scope, async (tx) =>
    tx.cooDirective.update({
      where: { id },
      data: {
        status: update.status,
        ...(update.approvedById !== undefined ? { approvedById: update.approvedById } : {}),
        ...(update.approvedAt !== undefined ? { approvedAt: update.approvedAt } : {}),
        ...(update.executedAt !== undefined ? { executedAt: update.executedAt } : {}),
        ...(update.executionResult !== undefined
          ? { executionResult: update.executionResult as any }
          : {}),
      },
      select: cooDirectiveSelect,
    }),
  );
}
