import { z } from "zod";
import type { IssueStatus } from "@prisma/client";
import type { TenantScope } from "@/db/tenant";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { parseWith } from "@/lib/validation";
import {
  createIssueQueueView,
  deleteIssueQueueView,
  findIssue,
  listIssueQueueViews,
  listIssues,
  updateIssueLifecycle,
  type IssueListFilters,
  type IssuePage,
  type IssueQueueViewRecord,
  type IssueRecord,
} from "@/services/issues/repository";

export const issueLifecycleSchema = z
  .object({
    action: z.enum(["ACKNOWLEDGE", "ASSIGN", "IGNORE", "RESOLVE"]).optional(),
    status: z.enum(["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "IGNORED"]).optional(),
    assignedToId: z.string().uuid().nullable().optional(),
  })
  .refine(
    (value) =>
      value.action !== undefined || value.status !== undefined || value.assignedToId !== undefined,
    {
      message: "Provide an issue action, status, or assignee.",
    },
  );

const actionStatus: Record<
  NonNullable<z.infer<typeof issueLifecycleSchema>["action"]>,
  IssueStatus
> = {
  ACKNOWLEDGE: "ACKNOWLEDGED",
  IGNORE: "IGNORED",
  RESOLVE: "RESOLVED",
  ASSIGN: "OPEN",
};

export function listOrganizationIssues(
  scope: TenantScope,
  filters?: IssueListFilters,
): Promise<IssuePage> {
  return listIssues(scope, filters);
}

const queueViewSchema = z.object({
  name: z.string().trim().min(1).max(80),
  filters: z.object({
    status: z
      .enum(["ALL", "ACTIVE", "OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "IGNORED"])
      .default("ALL"),
    severity: z.enum(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]).default("ALL"),
    sort: z.enum(["lastSeenAt", "severity", "status"]).default("lastSeenAt"),
    order: z.enum(["asc", "desc"]).default("desc"),
  }),
});

export function listSavedIssueViews(scope: TenantScope): Promise<IssueQueueViewRecord[]> {
  return listIssueQueueViews(scope);
}

export async function saveIssueView(scope: TenantScope, input: unknown) {
  const parsed = parseWith(queueViewSchema, input, "body");
  try {
    return await createIssueQueueView(scope, { name: parsed.name, filters: parsed.filters });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      throw new ConflictError("A saved view with this name already exists.");
    }
    throw error;
  }
}

export async function removeSavedIssueView(scope: TenantScope, viewId: string) {
  const removed = await deleteIssueQueueView(scope, viewId);
  if (!removed) throw new NotFoundError("Saved view");
}

export function getOrganizationIssue(
  scope: TenantScope,
  issueId: string,
): Promise<IssueRecord | null> {
  return findIssue(scope, issueId);
}

export async function applyIssueLifecycle(scope: TenantScope, issueId: string, input: unknown) {
  const parsed = parseWith(issueLifecycleSchema, input, "body");
  if (parsed.action === "ASSIGN" && parsed.assignedToId === undefined) {
    throw new ValidationError("ASSIGN requires assignedToId.");
  }
  if (parsed.action !== undefined && parsed.action !== "ASSIGN" && parsed.status !== undefined) {
    throw new ValidationError("An action cannot be combined with status.");
  }
  const status =
    parsed.action && parsed.action !== "ASSIGN" ? actionStatus[parsed.action] : parsed.status;
  return updateIssueLifecycle(scope, issueId, {
    status,
    assignedToId: parsed.assignedToId,
  });
}
