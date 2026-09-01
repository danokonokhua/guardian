import { createTenantScope } from "@/db/tenant";
import { withApiRoute, apiSuccess } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { triggerConfiguredMonitor } from "@/services/monitors/service";

export const POST = withApiRoute(async (_request, { params, requestId }) => {
  const organizationId = params.organizationId;
  const monitorId = params.monitorId;
  if (!organizationId || !monitorId) throw new Error("Missing monitor path parameters.");
  const context = await requirePermission(organizationId, "monitoring:manage");
  const data = await triggerConfiguredMonitor(createTenantScope(context), monitorId);
  return apiSuccess(data, requestId, 202);
});
