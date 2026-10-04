import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requireRole } from "@/lib/auth/context";
import { testMarketplacePlugin } from "@/services/marketplace/service";

export const POST = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId, pluginId } = params;
  if (!organizationId || !pluginId) {
    throw new Error("Missing organizationId or pluginId");
  }

  const context = await requireRole(organizationId, "ADMIN");
  const tenantScope = createTenantScope(context);

  const testResult = await testMarketplacePlugin(tenantScope, pluginId);

  return apiSuccess(testResult, requestId);
});
