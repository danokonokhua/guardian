import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { getBillingProvider, isLiveBillingConfigured } from "@/services/billing/provider";
import { getBillingSummary } from "@/services/billing/repository";
import { ValidationError, NotFoundError } from "@/lib/errors";

function resolveBaseUrl(request: Request, bodyUrl?: string): string {
  if (bodyUrl) {
    try {
      const parsed = new URL(bodyUrl);
      return parsed.origin;
    } catch {
      // ignore
    }
  }
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto =
    request.headers.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
  if (host) {
    return `${proto}://${host}`;
  }
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && !envUrl.includes("localhost")) {
    return envUrl;
  }
  return "http://localhost:3000";
}

export const POST = withApiRoute(async (request, { params, requestId }) => {
  const organizationId = params.organizationId;
  if (!organizationId) throw new ValidationError("Missing organization id.");
  const context = await requirePermission(organizationId, "org:update");

  const summary = await getBillingSummary(createTenantScope(context));
  if (!summary) throw new NotFoundError("Organization not found.");

  const body = (await request.json().catch(() => ({}))) as { returnUrl?: string };
  const baseUrl = resolveBaseUrl(request, body.returnUrl);
  const returnUrl = body.returnUrl || `${baseUrl}/billing`;

  const provider = getBillingProvider();
  const portal = await provider.createCustomerPortalSession({
    organizationId,
    returnUrl,
    providerCustomerId: summary.subscription?.providerCustomerId,
  });

  return apiSuccess(
    {
      ...portal,
      isLive: isLiveBillingConfigured(),
    },
    requestId,
    200,
  );
});
