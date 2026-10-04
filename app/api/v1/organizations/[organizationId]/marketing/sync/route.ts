import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import {
  seedSandboxMarketingCampaigns,
  getCrossChannelPerformance,
} from "@/services/marketing/service";

const syncSchema = z.object({
  seedSandbox: z.boolean().optional(),
  websiteId: z.string().optional().nullable(),
});

export const POST = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId } = params;
  if (!organizationId) throw new Error("Missing organizationId.");

  const context = await requirePermission(organizationId, "org:update");
  const tenantScope = createTenantScope(context);

  const body = syncSchema.parse(await request.json().catch(() => ({})));

  let overview;
  if (body.seedSandbox) {
    overview = await seedSandboxMarketingCampaigns(tenantScope, body.websiteId || undefined);
  } else {
    overview = await getCrossChannelPerformance(tenantScope, body.websiteId || undefined);
  }

  return apiSuccess({ synced: true, overview }, requestId);
});
