import { requirePermission } from "@/lib/auth/context";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import {
  disconnectIntegrationForTenant,
  syncGoogleIntegration,
} from "@/services/integrations/google/service";

export const POST = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId, integrationId } = params;
  if (!organizationId || !integrationId) {
    throw new Error("Missing organization or integration id.");
  }

  const context = await requirePermission(organizationId, "org:update");
  const tenantScope = createTenantScope(context);

  const result = await syncGoogleIntegration(tenantScope, integrationId);
  return apiSuccess(result, requestId);
});

export const DELETE = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId, integrationId } = params;
  if (!organizationId || !integrationId) {
    throw new Error("Missing organization or integration id.");
  }

  const context = await requirePermission(organizationId, "org:update");
  const tenantScope = createTenantScope(context);

  await disconnectIntegrationForTenant(tenantScope, integrationId);
  return apiSuccess({ disconnected: true }, requestId);
});

