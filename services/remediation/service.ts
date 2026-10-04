import "server-only";

import type { TenantScope } from "@/db/tenant";
import { withTenantTransaction } from "@/db/tenant";
import { assertCanUseAutomatedRemediation } from "@/lib/billing/entitlements";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { resolveBlueprint } from "./catalog";
import { executePipeline } from "./executor";
import {
  appendAuditEntries,
  createRemediationAction,
  findRemediationActionById,
  listRemediationActions,
  updateRemediationAction,
} from "./repository";
import type { AuditLogEntry, RemediationActionRecord, RemediationOverview } from "./types";

export interface ProposeRemediationInput {
  actionType: string;
  problem: string;
  evidence?: Record<string, any>;
  issueId?: string | null;
  websiteId?: string | null;
  planId?: string;
  actorUserId?: string | null;
}

export async function proposeRemediation(
  scope: TenantScope,
  input: ProposeRemediationInput,
): Promise<RemediationActionRecord> {
  // 1. Verify plan entitlement
  if (input.planId) {
    assertCanUseAutomatedRemediation(input.planId);
  } else {
    const org = await withTenantTransaction(scope, async (tx) =>
      tx.organization.findUnique({
        where: { id: scope.organizationId },
        select: { plan: true },
      }),
    );
    if (org?.plan) {
      assertCanUseAutomatedRemediation(org.plan);
    }
  }

  const blueprint = resolveBlueprint(input.actionType);
  const nowIso = new Date().toISOString();

  const initialAudit: AuditLogEntry[] = [
    {
      timestamp: nowIso,
      actorId: input.actorUserId ?? null,
      action: "PROPOSAL_CREATED",
      details: `Remediation proposal generated: ${blueprint.title} (Risk: ${blueprint.riskLevel})`,
      newStatus: "PENDING_APPROVAL",
    },
  ];

  let action = await createRemediationAction(scope, {
    issueId: input.issueId ?? null,
    websiteId: input.websiteId ?? null,
    actionType: blueprint.actionType,
    title: blueprint.title,
    description: blueprint.description,
    riskLevel: blueprint.riskLevel,
    problem: input.problem,
    evidence: input.evidence ?? {},
    recommendation: blueprint.recommendation,
    status: "PENDING_APPROVAL",
    autoExecutable: blueprint.autoExecutable,
    requestedById: input.actorUserId ?? null,
    rollbackPlan: blueprint.rollbackPlan as any,
    auditLog: initialAudit as any,
  });

  // If low risk and configured as auto-executable, run automatically
  if (blueprint.autoExecutable && blueprint.riskLevel === "LOW") {
    action = await approveAndExecuteRemediation(scope, action.id, null);
  }

  return action;
}

export async function approveAndExecuteRemediation(
  scope: TenantScope,
  actionId: string,
  actorUserId?: string | null,
): Promise<RemediationActionRecord> {
  const action = await findRemediationActionById(scope, actionId);
  if (!action) {
    throw new NotFoundError(`Remediation action ${actionId} not found`);
  }

  if (action.status === "COMPLETED") {
    throw new ValidationError("Remediation action has already completed successfully.");
  }

  const now = new Date();
  const approvedAction = await updateRemediationAction(scope, actionId, {
    status: "APPROVED",
    approvedById: actorUserId ?? null,
    approvedAt: now,
  });

  // Execute through 8-step pipeline
  const outcome = await executePipeline(approvedAction, actorUserId);

  await appendAuditEntries(scope, actionId, outcome.auditEntries);

  return updateRemediationAction(scope, actionId, {
    status: outcome.status,
    executedAt: now,
    verifiedAt: outcome.status === "COMPLETED" ? new Date() : null,
    rolledBackAt: outcome.status === "ROLLED_BACK" ? new Date() : null,
    executionResult: outcome.executionResult as any,
    verificationResult: outcome.verificationResult as any,
  });
}

export async function rollbackRemediation(
  scope: TenantScope,
  actionId: string,
  reason: string,
  actorUserId?: string | null,
): Promise<RemediationActionRecord> {
  const action = await findRemediationActionById(scope, actionId);
  if (!action) {
    throw new NotFoundError(`Remediation action ${actionId} not found`);
  }

  const now = new Date();
  const auditEntry: AuditLogEntry = {
    timestamp: now.toISOString(),
    actorId: actorUserId ?? null,
    action: "OPERATOR_TRIGGERED_ROLLBACK",
    details: `Rollback executed by operator: ${reason}`,
    previousStatus: action.status,
    newStatus: "ROLLED_BACK",
  };

  await appendAuditEntries(scope, actionId, [auditEntry]);

  return updateRemediationAction(scope, actionId, {
    status: "ROLLED_BACK",
    rolledBackAt: now,
  });
}

export async function rejectRemediation(
  scope: TenantScope,
  actionId: string,
  reason: string,
  actorUserId?: string | null,
): Promise<RemediationActionRecord> {
  const action = await findRemediationActionById(scope, actionId);
  if (!action) {
    throw new NotFoundError(`Remediation action ${actionId} not found`);
  }

  const now = new Date();
  const auditEntry: AuditLogEntry = {
    timestamp: now.toISOString(),
    actorId: actorUserId ?? null,
    action: "OPERATOR_REJECTED",
    details: `Remediation proposal rejected by operator: ${reason}`,
    previousStatus: action.status,
    newStatus: "REJECTED",
  };

  await appendAuditEntries(scope, actionId, [auditEntry]);

  return updateRemediationAction(scope, actionId, {
    status: "REJECTED",
  });
}

export async function getRemediationOverview(scope: TenantScope): Promise<RemediationOverview> {
  const allActions = await listRemediationActions(scope);

  let pendingApprovalsCount = 0;
  let completedCount = 0;
  let rolledBackCount = 0;

  for (const a of allActions) {
    if (a.status === "PENDING_APPROVAL") pendingApprovalsCount++;
    else if (a.status === "COMPLETED") completedCount++;
    else if (a.status === "ROLLED_BACK") rolledBackCount++;
  }

  const resolvedAttempts = completedCount + rolledBackCount;
  const verificationPassRatePct =
    resolvedAttempts > 0 ? Number(((completedCount / resolvedAttempts) * 100).toFixed(1)) : 100;

  return {
    totalActions: allActions.length,
    pendingApprovalsCount,
    completedCount,
    rolledBackCount,
    verificationPassRatePct,
    recentActions: allActions.slice(0, 25),
  };
}
