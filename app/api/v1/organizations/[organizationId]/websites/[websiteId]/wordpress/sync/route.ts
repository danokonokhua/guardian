import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { parseWith } from "@/lib/validation";
import { syncWordpressSite } from "@/services/integrations/wordpress/service";

const syncSchema = z.object({
  simulateFix: z.boolean().optional(),
});

export const POST = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId, websiteId } = params;
  if (!organizationId || !websiteId) {
    throw new Error("Missing organizationId or websiteId parameter.");
  }

  const context = await requirePermission(organizationId, "website:update");
  const tenantScope = createTenantScope(context);

  const rawBody = await request.json().catch(() => ({}));
  const body = parseWith(syncSchema, rawBody, "WordPress sync");

  const result = await syncWordpressSite(tenantScope, websiteId, {
    simulateFix: body.simulateFix,
  });

  return apiSuccess(result, requestId);
});
