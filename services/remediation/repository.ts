import "server-only";

import type { Prisma } from "@prisma/client";
import type { TenantScope } from "@/db/tenant";
import { withTenantTransaction } from "@/db/tenant";
import type { AuditLogEntry, RemediationActionRecord } from "./types";

const actionSelect = {
  id: true,
  organizationId: true,
  issueId: true,
  websiteId: true,
  actionType: true,
  title: true,
  description: true,
  riskLevel: true,
  problem: true,
  evidence: true,
  recommendation: true,
  status: true,
  autoExecutable: true,
  requestedById: true,
  approvedById: true,
  approvedAt: true,
  executedAt: true,
  verifiedAt: true,
  rolledBackAt: true,
  executionResult: true,
  verificationResult: true,
  rollbackPlan: true,
  auditLog: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function listRemediationActions(
  scope: TenantScope,
  status?: string,
): Promise<RemediationActionRecord[]> {
  return withTenantTransaction(scope, async (tx) =>
    tx.remediationAction.findMany({
      where: {
        organizationId: scope.organizationId,
        ...(status ? { status } : {}),
      },
      select: actionSelect,
      orderBy: { createdAt: "desc" },
    }),
  );
}

export async function findRemediationActionById(
  scope: TenantScope,
  id: string,
): Promise<RemediationActionRecord | null> {
  return withTenantTransaction(scope, async (tx) =>
    tx.remediationAction.findFirst({
      where: { id, organizationId: scope.organizationId },
      select: actionSelect,
    }),
  );
}

export async function createRemediationAction(
  scope: TenantScope,
  data: {
    issueId?: string | null;
    websiteId?: string | null;
    actionType: string;
    title: string;
    description: string;
    riskLevel: string;
    problem: string;
    evidence?: Prisma.InputJsonValue;
    recommendation: string;
    status?: string;
    autoExecutable?: boolean;
    requestedById?: string | null;
    rollbackPlan?: Prisma.InputJsonValue;
    auditLog?: Prisma.InputJsonValue;
  },
): Promise<RemediationActionRecord> {
  return withTenantTransaction(scope, async (tx) =>
    tx.remediationAction.create({
      data: {
        organizationId: scope.organizationId,
        issueId: data.issueId ?? null,
        websiteId: data.websiteId ?? null,
        actionType: data.actionType,
        title: data.title,
        description: data.description,
        riskLevel: data.riskLevel,
        problem: data.problem,
        evidence: data.evidence ?? {},
        recommendation: data.recommendation,
        status: data.status ?? "PENDING_APPROVAL",
        autoExecutable: data.autoExecutable ?? false,
        requestedById: data.requestedById ?? null,
        rollbackPlan: data.rollbackPlan ?? {},
        auditLog: data.auditLog ?? [],
      },
      select: actionSelect,
    }),
  );
}

export async function updateRemediationAction(
  scope: TenantScope,
  id: string,
  data: Prisma.RemediationActionUpdateInput,
): Promise<RemediationActionRecord> {
  return withTenantTransaction(scope, async (tx) =>
    tx.remediationAction.update({
      where: { id, organizationId: scope.organizationId },
      data,
      select: actionSelect,
    }),
  );
}

export async function appendAuditEntries(
  scope: TenantScope,
  id: string,
  newEntries: AuditLogEntry[],
): Promise<RemediationActionRecord> {
  return withTenantTransaction(scope, async (tx) => {
    const existing = await tx.remediationAction.findFirst({
      where: { id, organizationId: scope.organizationId },
      select: { auditLog: true },
    });
    const currentList = Array.isArray(existing?.auditLog) ? (existing!.auditLog as any[]) : [];
    const updatedList = [...currentList, ...newEntries];

    return tx.remediationAction.update({
      where: { id, organizationId: scope.organizationId },
      data: { auditLog: updatedList },
      select: actionSelect,
    });
  });
}
