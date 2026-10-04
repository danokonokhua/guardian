import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission, requireRole } from "@/lib/auth/context";
import {
  getPredictiveOverview,
  generatePredictiveForecastsForOrg,
} from "@/services/predictive/service";

export const GET = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId } = params;
  if (!organizationId) throw new Error("Missing organizationId");

  const context = await requirePermission(organizationId, "org:read");
  const tenantScope = createTenantScope(context);

  const overview = await getPredictiveOverview(tenantScope);
  return apiSuccess(overview, requestId);
});

export const POST = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId } = params;
  if (!organizationId) throw new Error("Missing organizationId");

  const context = await requireRole(organizationId, "ADMIN");
  const tenantScope = createTenantScope(context);

  const result = await generatePredictiveForecastsForOrg(tenantScope);
  return apiSuccess(result, requestId, 201);
});
