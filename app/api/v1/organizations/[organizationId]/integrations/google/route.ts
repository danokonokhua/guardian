import { requirePermission } from "@/lib/auth/context";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { assertCanUseGoogleIntegrations } from "@/lib/billing/entitlements";
import { getBillingSummary } from "@/services/billing/repository";
import {
  connectMockGoogleService,
  listIntegrationsForTenant,
} from "@/services/integrations/google/service";
import { buildGoogleAuthUrl, isGoogleOAuthConfigured } from "@/lib/integrations/google/oauth";
import { randomBytes } from "node:crypto";
import { z } from "zod";

const connectSchema = z.object({
  provider: z.enum(["GA4", "SEARCH_CONSOLE", "BUSINESS_PROFILE"]),
  propertyName: z.string().trim().min(1).default("Production Property"),
  mode: z.enum(["sandbox", "oauth"]).default("sandbox"),
});

export const GET = withApiRoute(async (_request, { params, requestId }) => {
  const organizationId = params.organizationId;
  if (!organizationId) throw new Error("Missing organization id.");
  const context = await requirePermission(organizationId, "org:read");
  const tenantScope = createTenantScope(context);

  const [integrations, billing] = await Promise.all([
    listIntegrationsForTenant(tenantScope),
    getBillingSummary(tenantScope),
  ]);

  return apiSuccess(
    {
      integrations,
      oauthConfigured: isGoogleOAuthConfigured(),
      plan: billing?.plan ?? "PRO",
    },
    requestId,
  );
});

export const POST = withApiRoute(async (request, { params, requestId }) => {
  const organizationId = params.organizationId;
  if (!organizationId) throw new Error("Missing organization id.");
  const context = await requirePermission(organizationId, "org:update");
  const tenantScope = createTenantScope(context);

  const billing = await getBillingSummary(tenantScope);
  const plan = billing?.plan ?? "PRO";

  // Check plan entitlement
  assertCanUseGoogleIntegrations(plan);

  const body = connectSchema.parse(await request.json().catch(() => ({})));

  if (body.mode === "oauth" && isGoogleOAuthConfigured()) {
    const state = randomBytes(16).toString("hex");
    const authUrl = buildGoogleAuthUrl(organizationId, state);
    return apiSuccess({ redirectUrl: authUrl }, requestId);
  }

  // Connect via Sandbox / Mock mode
  const integration = await connectMockGoogleService(tenantScope, body.provider, body.propertyName);

  return apiSuccess({ integration, connected: true }, requestId, 201);
});
