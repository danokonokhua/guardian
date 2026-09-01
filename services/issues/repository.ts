import "server-only";

import type { IssueSeverity, IssueStatus, Prisma } from "@prisma/client";
import { NotFoundError } from "@/lib/errors";
import { withTenantTransaction, type TenantScope } from "@/db/tenant";

export interface IssueRecord {
  id: string;
  organizationId: string;
  websiteId: string;
  monitorId: string | null;
  ruleId: string;
  severity: string;
  status: IssueStatus;
  title: string;
  summary: string;
  technicalEvidence: Prisma.JsonValue;
  firstSeenAt: Date;
  lastSeenAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  resolvedById: string | null;
  assignedToId: string | null;
  assignedTo: { id: string; email: string; name: string | null } | null;
  activities: Array<{
    id: string;
    action: string;
    fromStatus: IssueStatus | null;
    toStatus: IssueStatus | null;
    createdAt: Date;
    actor: { id: string; email: string; name: string | null } | null;
    assignedTo: { id: string; email: string; name: string | null } | null;
  }>;
  websiteName: string;
}

const select = {
  id: true,
  organizationId: true,
  websiteId: true,
  monitorId: true,
  ruleId: true,
  severity: true,
  status: true,
  title: true,
  summary: true,
  technicalEvidence: true,
  firstSeenAt: true,
  lastSeenAt: true,
  resolvedAt: true,
  resolvedBy: true,
  resolvedById: true,
  assignedToId: true,
  assignedTo: { select: { id: true, email: true, name: true } },
  activities: {
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      action: true,
      fromStatus: true,
      toStatus: true,
      createdAt: true,
      actor: { select: { id: true, email: true, name: true } },
      assignedTo: { select: { id: true, email: true, name: true } },
    },
  },
  website: { select: { hostname: true, label: true } },
} as const;

function mapIssue(issue: Prisma.IssueGetPayload<{ select: typeof select }>): IssueRecord {
  return {
    id: issue.id,
    organizationId: issue.organizationId,
    websiteId: issue.websiteId,
    monitorId: issue.monitorId,
    ruleId: issue.ruleId,
    severity: issue.severity,
    status: issue.status,
    title: issue.title,
    summary: issue.summary,
    technicalEvidence: issue.technicalEvidence,
    firstSeenAt: issue.firstSeenAt,
    lastSeenAt: issue.lastSeenAt,
    resolvedAt: issue.resolvedAt,
    resolvedBy: issue.resolvedBy,
    resolvedById: issue.resolvedById,
    assignedToId: issue.assignedToId,
    assignedTo: issue.assignedTo,
    activities: issue.activities,
    websiteName: issue.website.label || issue.website.hostname,
  };
}

export interface IssueListFilters {
  status?: IssueStatus | "ACTIVE";
  severity?: IssueSeverity;
  orderBy?: "lastSeenAt" | "severity" | "status";
  order?: "asc" | "desc";
  cursor?: string;
  limit?: number;
}

export interface IssuePage {
  items: IssueRecord[];
  nextCursor: string | null;
}

export function listIssues(scope: TenantScope, filters: IssueListFilters = {}): Promise<IssuePage> {
  return withTenantTransaction(scope, async (tx) => {
    const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);
    const rows = await tx.issue.findMany({
      where: {
        organizationId: scope.organizationId,
        ...(filters.status === "ACTIVE"
          ? { status: { notIn: ["RESOLVED", "IGNORED"] } }
          : filters.status
            ? { status: filters.status }
            : {}),
        ...(filters.severity ? { severity: filters.severity } : {}),
      },
      orderBy: { [filters.orderBy ?? "lastSeenAt"]: filters.order ?? "desc" },
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
      take: limit + 1,
      select,
    });
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: pageRows.map(mapIssue),
      nextCursor: hasMore ? (pageRows.at(-1)?.id ?? null) : null,
    };
  });
}

export interface IssueQueueViewRecord {
  id: string;
  name: string;
  filters: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}

export function listIssueQueueViews(scope: TenantScope): Promise<IssueQueueViewRecord[]> {
  return withTenantTransaction(scope, (tx) =>
    tx.issueQueueView.findMany({
      where: { organizationId: scope.organizationId, userId: scope.userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, filters: true, createdAt: true, updatedAt: true },
    }),
  );
}

export function createIssueQueueView(
  scope: TenantScope,
  input: { name: string; filters: Prisma.InputJsonValue },
): Promise<IssueQueueViewRecord> {
  return withTenantTransaction(scope, (tx) =>
    tx.issueQueueView.create({
      data: { organizationId: scope.organizationId, userId: scope.userId, ...input },
      select: { id: true, name: true, filters: true, createdAt: true, updatedAt: true },
    }),
  );
}

export async function deleteIssueQueueView(scope: TenantScope, viewId: string): Promise<boolean> {
  return withTenantTransaction(scope, async (tx) => {
    const result = await tx.issueQueueView.deleteMany({
      where: { id: viewId, organizationId: scope.organizationId, userId: scope.userId },
    });
    return result.count > 0;
  });
}

export function findIssue(scope: TenantScope, issueId: string): Promise<IssueRecord | null> {
  return withTenantTransaction(scope, async (tx) => {
    const row = await tx.issue.findFirst({
      where: { id: issueId, organizationId: scope.organizationId },
      select,
    });
    return row ? mapIssue(row) : null;
  });
}

export async function updateIssueLifecycle(
  scope: TenantScope,
  issueId: string,
  input: { status?: IssueStatus; assignedToId?: string | null },
): Promise<IssueRecord> {
  return withTenantTransaction(scope, async (tx) => {
    const existing = await tx.issue.findFirst({
      where: { id: issueId, organizationId: scope.organizationId },
      select: { id: true, status: true, assignedToId: true },
    });
    if (!existing) throw new NotFoundError("Issue");

    if (input.assignedToId !== undefined && input.assignedToId !== null) {
      const member = await tx.organizationMember.findFirst({
        where: {
          organizationId: scope.organizationId,
          userId: input.assignedToId,
          status: "ACTIVE",
        },
        select: { userId: true },
      });
      if (!member) throw new NotFoundError("Assignee");
    }

    const data: Prisma.IssueUpdateInput = {};
    if (input.assignedToId !== undefined) {
      data.assignedTo = input.assignedToId
        ? { connect: { id: input.assignedToId } }
        : { disconnect: true };
    }
    if (input.status !== undefined) {
      data.status = input.status;
      if (input.status === "RESOLVED") {
        data.resolvedAt = new Date();
        data.resolvedBy = "USER";
        data.resolvedByUser = { connect: { id: scope.userId } };
      } else {
        data.resolvedAt = null;
        data.resolvedBy = null;
        data.resolvedByUser = { disconnect: true };
      }
    }

    const updated = await tx.issue.update({ where: { id: issueId }, data, select });
    if (input.status !== undefined && input.status !== existing.status) {
      await tx.issueActivity.create({
        data: {
          organizationId: scope.organizationId,
          issueId,
          actorUserId: scope.userId,
          action: input.status === "RESOLVED" ? "RESOLVED" : input.status,
          fromStatus: existing.status,
          toStatus: input.status,
          assignedToId: input.assignedToId ?? existing.assignedToId,
        },
      });
    }
    if (input.assignedToId !== undefined && input.assignedToId !== existing.assignedToId) {
      await tx.issueActivity.create({
        data: {
          organizationId: scope.organizationId,
          issueId,
          actorUserId: scope.userId,
          action: "ASSIGNED",
          assignedToId: input.assignedToId,
          metadata: { previousAssigneeId: existing.assignedToId },
        },
      });
    }
    return mapIssue(updated);
  });
}
