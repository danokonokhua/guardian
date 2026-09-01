import { createTenantScope } from "@/db/tenant";
import { withApiRoute, apiSuccess } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { updateConfiguredMonitor } from "@/services/monitors/service";

export const PATCH = withApiRoute(async (request, { params, requestId }) => {
  const organizationId = params.organizationId;
  const monitorId = params.monitorId;
  if (!organizationId || !monitorId) throw new Error("Missing monitor path parameters.");
  const context = await requirePermission(organizationId, "monitoring:manage");
  const data = await updateConfiguredMonitor(
    createTenantScope(context),
    monitorId,
    await request.json(),
  );
  return apiSuccess(data, requestId);
});
