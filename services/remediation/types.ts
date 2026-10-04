import type { Prisma } from "@prisma/client";

export type RemediationRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type RemediationStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "EXECUTING"
  | "VERIFYING"
  | "COMPLETED"
  | "FAILED"
  | "ROLLED_BACK"
  | "REJECTED";

export interface AuditLogEntry {
  timestamp: string;
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  details?: string;
  previousStatus?: string;
  newStatus: string;
}

export interface RollbackPlan {
  action: string;
  description: string;
  originalState: Record<string, any>;
  steps: string[];
}

export interface RemediationActionRecord {
  id: string;
  organizationId: string;
  issueId: string | null;
  websiteId: string | null;
  actionType: string;
  title: string;
  description: string;
  riskLevel: string;
  problem: string;
  evidence: Prisma.JsonValue;
  recommendation: string;
  status: string;
  autoExecutable: boolean;
  requestedById: string | null;
  approvedById: string | null;
  approvedAt: Date | null;
  executedAt: Date | null;
  verifiedAt: Date | null;
  rolledBackAt: Date | null;
  executionResult: Prisma.JsonValue;
  verificationResult: Prisma.JsonValue;
  rollbackPlan: Prisma.JsonValue;
  auditLog: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}

export interface RemediationBlueprint {
  actionType: string;
  title: string;
  description: string;
  riskLevel: RemediationRiskLevel;
  recommendation: string;
  autoExecutable: boolean;
  rollbackPlan: RollbackPlan;
}

export interface RemediationOverview {
  totalActions: number;
  pendingApprovalsCount: number;
  completedCount: number;
  rolledBackCount: number;
  verificationPassRatePct: number;
  recentActions: RemediationActionRecord[];
}
