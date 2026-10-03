import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { probeCompetitor } from "@/services/competitors/service";

const syncSchema = z.object({
  isSandbox: z.boolean().optional(),
  forceOfferChange: z.string().optional(),
});

export const POST = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId, competitorId } = params;
  if (!organizationId || !competitorId) throw new Error("Missing parameters.");

  const context = await requirePermission(organizationId, "org:update");
  const tenantScope = createTenantScope(context);

  const body = syncSchema.parse(await request.json().catch(() => ({})));

  const result = await probeCompetitor(tenantScope, competitorId, body);

  return apiSuccess(result, requestId);
});

