import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { getAgencyBranding } from "@/services/agency/repository";
import { saveAgencyBranding } from "@/services/agency/service";

const brandingSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required"),
  logoUrl: z.string().trim().url().optional().nullable(),
  brandPrimaryColor: z.string().trim().optional().nullable(),
  brandAccentColor: z.string().trim().optional().nullable(),
  customDomain: z.string().trim().optional().nullable(),
  portalTitle: z.string().trim().optional().nullable(),
  supportEmail: z.string().trim().email().optional().nullable(),
  footerText: z.string().trim().optional().nullable(),
  isWhiteLabelActive: z.boolean().optional(),
});

export const GET = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId } = params;
  if (!organizationId) throw new Error("Missing organizationId.");

  const context = await requirePermission(organizationId, "org:read");
  const tenantScope = createTenantScope(context);

  const branding = await getAgencyBranding(tenantScope);

  return apiSuccess({ branding }, requestId);
});

export const PUT = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId } = params;
  if (!organizationId) throw new Error("Missing organizationId.");

  const context = await requirePermission(organizationId, "org:update");
  const tenantScope = createTenantScope(context);

  const body = brandingSchema.parse(await request.json().catch(() => ({})));

  const branding = await saveAgencyBranding(tenantScope, {
    companyName: body.companyName,
    logoUrl: body.logoUrl,
    brandPrimaryColor: body.brandPrimaryColor,
    brandAccentColor: body.brandAccentColor,
    customDomain: body.customDomain,
    portalTitle: body.portalTitle,
    supportEmail: body.supportEmail,
    footerText: body.footerText,
    isWhiteLabelActive: body.isWhiteLabelActive,
  });

  return apiSuccess(branding, requestId);
});
