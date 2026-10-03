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
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const baseUrl = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL || "");
  const returnUrl = body.returnUrl || `${baseUrl}/billing`;

  const provider = getBillingProvider();
  const portal = await provider.createCustomerPortalSession({
    organizationId,
    returnUrl,
    providerCustomerId: summary.subscription?.providerCustomerId,
  });

  return apiSuccess({
    ...portal,
    livePaymentConnected: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith("sk_")),
  }, requestId, 200);
});
