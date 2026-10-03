import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { syncAllCompetitors } from "@/services/competitors/service";

const bulkSyncSchema = z.object({
  isSandbox: z.boolean().optional(),
});

export const POST = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId } = params;
  if (!organizationId) throw new Error("Missing organizationId.");

  const context = await requirePermission(organizationId, "org:update");
  const tenantScope = createTenantScope(context);

  const body = bulkSyncSchema.parse(await request.json().catch(() => ({})));

  const result = await syncAllCompetitors(tenantScope, body);

  return apiSuccess(result, requestId);
});

