import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { verifyWebsite } from "@/services/websites/service";

export const POST = withApiRoute(async (_request, { params, requestId }) => {
  const organizationId = params.organizationId;
  const websiteId = params.websiteId;
  if (!organizationId || !websiteId) throw new Error("Missing website path parameters.");
  const context = await requirePermission(organizationId, "website:scan");
  return apiSuccess(await verifyWebsite(createTenantScope(context), websiteId), requestId);
});
