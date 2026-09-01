import { requirePermission } from "@/lib/auth/context";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { configureMonitor, listConfiguredMonitors } from "@/services/monitors/service";

export const GET = withApiRoute(async (_request, { params, requestId }) => {
  const organizationId = params.organizationId;
  if (!organizationId) throw new Error("Missing organization id.");
  const context = await requirePermission(organizationId, "monitoring:read");
  const data = await listConfiguredMonitors(createTenantScope(context));
  return apiSuccess(data, requestId);
});

export const POST = withApiRoute(async (request, { params, requestId }) => {
  const organizationId = params.organizationId;
  if (!organizationId) throw new Error("Missing organization id.");
  const context = await requirePermission(organizationId, "monitoring:manage");
  const data = await configureMonitor(createTenantScope(context), await request.json());
  return apiSuccess(data, requestId, 201);
});
