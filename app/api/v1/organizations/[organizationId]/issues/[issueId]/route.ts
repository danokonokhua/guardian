import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { NotFoundError } from "@/lib/errors";
import { parseWith } from "@/lib/validation";
import { applyIssueLifecycle, getOrganizationIssue } from "@/services/issues/service";

const paramsSchema = z.object({ organizationId: z.string().uuid(), issueId: z.string().uuid() });

export const GET = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId, issueId } = parseWith(paramsSchema, params, "path");
  const context = await requirePermission(organizationId, "issue:read");
  const issue = await getOrganizationIssue(createTenantScope(context), issueId);
  if (!issue) throw new NotFoundError("Issue");
  return apiSuccess(issue, requestId);
});

export const PATCH = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId, issueId } = parseWith(paramsSchema, params, "path");
  const context = await requirePermission(organizationId, "issue:manage");
  const issue = await applyIssueLifecycle(
    createTenantScope(context),
    issueId,
    await request.json(),
  );
  return apiSuccess(issue, requestId);
});
