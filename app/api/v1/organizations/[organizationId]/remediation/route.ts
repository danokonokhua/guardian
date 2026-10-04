import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { proposeRemediation, getRemediationOverview } from "@/services/remediation/service";

const proposeSchema = z.object({
  actionType: z.string().trim().min(1, "actionType is required"),
  problem: z.string().trim().min(1, "problem description is required"),
  evidence: z.record(z.string(), z.any()).optional(),
  issueId: z.string().optional().nullable(),
  websiteId: z.string().optional().nullable(),
});

export const GET = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId } = params;
  if (!organizationId) throw new Error("Missing organizationId.");

  const context = await requirePermission(organizationId, "issue:read");
  const tenantScope = createTenantScope(context);

  const overview = await getRemediationOverview(tenantScope);

  return apiSuccess({ overview }, requestId);
});

export const POST = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId } = params;
  if (!organizationId) throw new Error("Missing organizationId.");

  const context = await requirePermission(organizationId, "issue:manage");
  const tenantScope = createTenantScope(context);

  const body = proposeSchema.parse(await request.json().catch(() => ({})));

  const action = await proposeRemediation(tenantScope, {
    actionType: body.actionType,
    problem: body.problem,
    evidence: body.evidence,
    issueId: body.issueId,
    websiteId: body.websiteId,
    actorUserId: context.user.userId,
  });

  return apiSuccess(action, requestId, 201);
});
