import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { assertCanUseWordpressConnect } from "@/lib/billing/entitlements";
import { getBillingSummary } from "@/services/billing/repository";
import {
  connectWordpressSite,
  disconnectWordpressSite,
} from "@/services/integrations/wordpress/service";
import { findWordpressConnection } from "@/services/integrations/wordpress/repository";

const connectSchema = z.object({
  siteUrl: z.string().url().optional(),
  isSandbox: z.boolean().default(false),
});

export const GET = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId, websiteId } = params;
  if (!organizationId || !websiteId) {
    throw new Error("Missing organizationId or websiteId parameter.");
  }

  const context = await requirePermission(organizationId, "website:read");
  const tenantScope = createTenantScope(context);

  const [connection, billing] = await Promise.all([
    findWordpressConnection(tenantScope, websiteId),
    getBillingSummary(tenantScope),
  ]);

  return apiSuccess(
    {
      connection,
      plan: billing?.plan ?? "PRO",
    },
    requestId,
  );
});

export const POST = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId, websiteId } = params;
  if (!organizationId || !websiteId) {
    throw new Error("Missing organizationId or websiteId parameter.");
  }

  const context = await requirePermission(organizationId, "website:update");
  const tenantScope = createTenantScope(context);

  const billing = await getBillingSummary(tenantScope);
  const plan = billing?.plan ?? "PRO";

  const body = connectSchema.parse(await request.json().catch(() => ({})));

  // Sandbox demo mode is accessible to all tiers so users can test & evaluate
  if (!body.isSandbox) {
    assertCanUseWordpressConnect(plan);
  }

  const result = await connectWordpressSite(tenantScope, {
    websiteId,
    siteUrl: body.siteUrl,
    isSandbox: body.isSandbox,
  });

  return apiSuccess(result, requestId, 201);
});

export const DELETE = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId, websiteId } = params;
  if (!organizationId || !websiteId) {
    throw new Error("Missing organizationId or websiteId parameter.");
  }

  const context = await requirePermission(organizationId, "website:update");
  const tenantScope = createTenantScope(context);

  await disconnectWordpressSite(tenantScope, websiteId);

  return apiSuccess({ success: true, websiteId }, requestId);
});
