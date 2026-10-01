import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { getBillingProvider } from "@/services/billing/provider";
import { getBillingSummary } from "@/services/billing/repository";
import { ValidationError, NotFoundError } from "@/lib/errors";

export const POST = withApiRoute(async (request, { params, requestId }) => {
  const organizationId = params.organizationId;
  if (!organizationId) throw new ValidationError("Missing organization id.");
  const context = await requirePermission(organizationId, "org:update");

  const summary = await getBillingSummary(createTenantScope(context));
  if (!summary) throw new NotFoundError("Organization not found.");

  const body = (await request.json().catch(() => ({}))) as { returnUrl?: string };
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const returnUrl = body.returnUrl || `${baseUrl}/billing`;

  const provider = getBillingProvider();
  const portal = await provider.createCustomerPortalSession({
    organizationId,
    returnUrl,
    providerCustomerId: summary.subscription?.providerCustomerId,
  });

  return apiSuccess(portal, requestId, 200);
});
