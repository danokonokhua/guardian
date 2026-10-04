import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission, requireRole } from "@/lib/auth/context";
import { parseWith } from "@/lib/validation";
import {
  getMarketplaceCatalog,
  installMarketplacePlugin,
} from "@/services/marketplace/service";

const installPluginSchema = z.object({
  pluginId: z.string().trim().min(1, "Plugin ID is required"),
  config: z.record(z.string(), z.unknown()).default({}),
  credentials: z.record(z.string(), z.unknown()).optional(),
});

export const GET = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId } = params;
  if (!organizationId) throw new Error("Missing organizationId");

  const context = await requirePermission(organizationId, "org:read");
  const tenantScope = createTenantScope(context);

  const overview = await getMarketplaceCatalog(tenantScope);
  return apiSuccess(overview, requestId);
});

export const POST = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId } = params;
  if (!organizationId) throw new Error("Missing organizationId");

  const context = await requireRole(organizationId, "ADMIN");
  const tenantScope = createTenantScope(context);

  const body = await request.json().catch(() => ({}));
  const validated = parseWith(installPluginSchema, body, "body");

  const result = await installMarketplacePlugin(
    tenantScope,
    {
      pluginId: validated.pluginId,
      config: validated.config,
      credentials: validated.credentials,
    }
  );

  return apiSuccess(result, requestId, 201);
});
