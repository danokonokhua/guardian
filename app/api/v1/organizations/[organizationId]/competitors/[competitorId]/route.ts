import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import {
  getCompetitorDetails,
  updateCompetitorDetails,
  removeCompetitor,
} from "@/services/competitors/service";

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  targetUrl: z.string().trim().min(1).optional(),
  status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]).optional(),
});

export const GET = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId, competitorId } = params;
  if (!organizationId || !competitorId) throw new Error("Missing parameters.");

  const context = await requirePermission(organizationId, "org:read");
  const tenantScope = createTenantScope(context);

  const details = await getCompetitorDetails(tenantScope, competitorId);

  return apiSuccess(details, requestId);
});

export const PATCH = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId, competitorId } = params;
  if (!organizationId || !competitorId) throw new Error("Missing parameters.");

  const context = await requirePermission(organizationId, "org:update");
  const tenantScope = createTenantScope(context);

  const body = updateSchema.parse(await request.json().catch(() => ({})));

  const updated = await updateCompetitorDetails(tenantScope, competitorId, body);

  return apiSuccess(updated, requestId);
});

export const DELETE = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId, competitorId } = params;
  if (!organizationId || !competitorId) throw new Error("Missing parameters.");

  const context = await requirePermission(organizationId, "org:update");
  const tenantScope = createTenantScope(context);

  await removeCompetitor(tenantScope, competitorId);

  return apiSuccess({ deleted: true }, requestId);
});
