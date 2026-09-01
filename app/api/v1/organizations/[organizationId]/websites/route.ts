import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { listConfiguredWebsites, onboardWebsite } from "@/services/websites/service";

export const GET = withApiRoute(async (_request, { params, requestId }) => {
  const organizationId = params.organizationId;
  if (!organizationId) throw new Error("Missing organization id.");
  const context = await requirePermission(organizationId, "website:read");
  return apiSuccess(await listConfiguredWebsites(createTenantScope(context)), requestId);
});

export const POST = withApiRoute(async (request, { params, requestId }) => {
  const organizationId = params.organizationId;
  if (!organizationId) throw new Error("Missing organization id.");
  const context = await requirePermission(organizationId, "website:create");
  const data = await onboardWebsite(createTenantScope(context), await request.json());
  return apiSuccess(data, requestId, 201);
});
