import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requireRole } from "@/lib/auth/context";
import { parseWith } from "@/lib/validation";
import { setPluginStatus, uninstallMarketplacePlugin } from "@/services/marketplace/service";

const updateStatusSchema = z.object({
  status: z.enum(["ACTIVE", "PAUSED", "DISABLED"]),
});

export const PATCH = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId, pluginId } = params;
  if (!organizationId || !pluginId) {
    throw new Error("Missing organizationId or pluginId");
  }

  const context = await requireRole(organizationId, "ADMIN");
  const tenantScope = createTenantScope(context);

  const body = await request.json().catch(() => ({}));
  const validated = parseWith(updateStatusSchema, body, "body");

  const updated = await setPluginStatus(tenantScope, pluginId, validated.status);

  return apiSuccess(updated, requestId);
});

export const DELETE = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId, pluginId } = params;
  if (!organizationId || !pluginId) {
    throw new Error("Missing organizationId or pluginId");
  }

  const context = await requireRole(organizationId, "ADMIN");
  const tenantScope = createTenantScope(context);

  await uninstallMarketplacePlugin(tenantScope, pluginId);

  return apiSuccess({ uninstalled: true, pluginId }, requestId);
});
