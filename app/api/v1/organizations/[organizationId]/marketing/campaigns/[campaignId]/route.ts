import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import {
  getCampaignDetails,
  updateCampaignDetails,
  removeCampaign,
} from "@/services/marketing/service";

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).optional(),
  budgetDailyCents: z.number().int().nonnegative().optional().nullable(),
});

export const GET = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId, campaignId } = params;
  if (!organizationId || !campaignId) throw new Error("Missing parameters.");

  const context = await requirePermission(organizationId, "org:read");
  const tenantScope = createTenantScope(context);

  const details = await getCampaignDetails(tenantScope, campaignId);

  return apiSuccess(details, requestId);
});

export const PATCH = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId, campaignId } = params;
  if (!organizationId || !campaignId) throw new Error("Missing parameters.");

  const context = await requirePermission(organizationId, "org:update");
  const tenantScope = createTenantScope(context);

  const body = updateSchema.parse(await request.json().catch(() => ({})));

  const updated = await updateCampaignDetails(tenantScope, campaignId, body);

  return apiSuccess(updated, requestId);
});

export const DELETE = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId, campaignId } = params;
  if (!organizationId || !campaignId) throw new Error("Missing parameters.");

  const context = await requirePermission(organizationId, "org:update");
  const tenantScope = createTenantScope(context);

  await removeCampaign(tenantScope, campaignId);

  return apiSuccess({ deleted: true }, requestId);
});
