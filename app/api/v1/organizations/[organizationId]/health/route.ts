import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { readHealthOverview } from "@/services/health/repository";

export const GET = withApiRoute(async (_request, { params, requestId }) => {
  const organizationId = params.organizationId;
  if (!organizationId) throw new Error("Missing organization id.");
  const context = await requirePermission(organizationId, "health:read");
  return apiSuccess(await readHealthOverview(createTenantScope(context)), requestId);
});
