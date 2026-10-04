import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { sendTestPushToUser } from "@/services/mobile/push-dispatcher";

export const POST = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId } = params;
  if (!organizationId) throw new Error("Missing organizationId");

  const context = await requirePermission(organizationId, "org:read");
  const tenantScope = createTenantScope(context);

  const result = await sendTestPushToUser(tenantScope, context.user.userId);

  return apiSuccess(result, requestId);
});
