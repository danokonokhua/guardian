import { requirePermission } from "@/lib/auth/context";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { assertCanUseAdvancedSeo } from "@/lib/billing/entitlements";
import { getPlanFeatures } from "@/config/billing-plans";
import { getBillingSummary } from "@/services/billing/repository";
import { performAdvancedSeoAnalysis } from "@/services/seo/advanced-seo-collector";
import { z } from "zod";

const triggerScanSchema = z.object({
  websiteId: z.string().uuid().optional(),
});

export const GET = withApiRoute(async (request, { params, requestId }) => {
  const organizationId = params.organizationId;
  if (!organizationId) throw new Error("Missing organization id.");
  const context = await requirePermission(organizationId, "org:read");
  const tenantScope = createTenantScope(context);

  const billing = await getBillingSummary(tenantScope);
  const plan = billing?.plan ?? "FREE";
  const features = getPlanFeatures(plan);
  const hasAdvancedSeo = Boolean(features.advancedSeo);

  if (!hasAdvancedSeo) {
    return apiSuccess(
      {
        hasAdvancedSeo: false,
        plan,
        message: "Advanced SEO Intelligence is available on the Growth plan and above.",
        analysis: null,
      },
      requestId,
    );
  }

  const url = new URL(request.url);
  const websiteId = url.searchParams.get("websiteId") ?? undefined;

  const analysis = await performAdvancedSeoAnalysis(tenantScope, websiteId);

  return apiSuccess(
    {
      hasAdvancedSeo: true,
      plan,
      analysis,
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
  const plan = billing?.plan ?? "FREE";

  // Enforce plan entitlement
  assertCanUseAdvancedSeo(plan);

  const body = triggerScanSchema.parse(await request.json().catch(() => ({})));
  const analysis = await performAdvancedSeoAnalysis(tenantScope, body.websiteId);

  return apiSuccess(
    {
      analysis,
      scannedAt: analysis.scannedAt,
    },
    requestId,
  );
});
