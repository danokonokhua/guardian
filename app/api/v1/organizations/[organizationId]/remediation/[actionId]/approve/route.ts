import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { approveAndExecuteRemediation } from "@/services/remediation/service";

export const POST = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId, actionId } = params;
  if (!organizationId || !actionId) throw new Error("Missing parameters.");

  const context = await requirePermission(organizationId, "issue:manage");
  const tenantScope = createTenantScope(context);

  const action = await approveAndExecuteRemediation(tenantScope, actionId, context.user.userId);

  return apiSuccess(action, requestId);
});
