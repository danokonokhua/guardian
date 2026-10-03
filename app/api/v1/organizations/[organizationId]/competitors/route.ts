import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { registerCompetitor, getCompetitorComparisonMetrics } from "@/services/competitors/service";
import { listCompetitors } from "@/services/competitors/repository";

const addCompetitorSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  urlOrDomain: z.string().trim().min(1, "URL or domain is required"),
  websiteId: z.string().optional().nullable(),
  isSandbox: z.boolean().optional(),
});

export const GET = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId } = params;
  if (!organizationId) throw new Error("Missing organizationId.");
  const context = await requirePermission(organizationId, "org:read");
  const tenantScope = createTenantScope(context);
  const url = new URL(request.url);
  const websiteId = url.searchParams.get("websiteId") || undefined;
  const [competitors, comparison] = await Promise.all([
    listCompetitors(tenantScope, websiteId),
    getCompetitorComparisonMetrics(tenantScope, websiteId),
  ]);
  return apiSuccess({ competitors, comparison }, requestId);
});

export const POST = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId } = params;
  if (!organizationId) throw new Error("Missing organizationId.");
  const context = await requirePermission(organizationId, "org:update");
  const tenantScope = createTenantScope(context);
  const body = addCompetitorSchema.parse(await request.json().catch(() => ({})));
  const result = await registerCompetitor(tenantScope, {
    name: body.name,
    urlOrDomain: body.urlOrDomain,
    websiteId: body.websiteId,
    isSandbox: body.isSandbox,
  });
  return apiSuccess(result, requestId, 201);
});