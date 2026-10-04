import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { getBillingProvider, isLiveBillingConfigured } from "@/services/billing/provider";
import { ValidationError } from "@/lib/errors";
import { BILLING_PLANS } from "@/config/billing-plans";
import type { Plan, BillingInterval } from "@prisma/client";

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

  const body = (await request.json().catch(() => ({}))) as {
    plan?: string;
    interval?: string;
    successUrl?: string;
    cancelUrl?: string;
  };

  if (!body.plan || !BILLING_PLANS.some((p) => p.id === body.plan)) {
    throw new ValidationError(`Invalid or missing plan: ${body.plan}`);
  }

  const interval: BillingInterval = body.interval === "ANNUAL" ? "ANNUAL" : "MONTHLY";
  const baseUrl = resolveBaseUrl(request, body.successUrl);

  const successUrl =
    body.successUrl || `${baseUrl}/billing?session_id={CHECKOUT_SESSION_ID}&success=true`;
  const cancelUrl = body.cancelUrl || `${baseUrl}/billing?canceled=true`;

  const provider = getBillingProvider();
  const session = await provider.createCheckoutSession({
    organizationId,
    plan: body.plan as Plan,
    interval,
    successUrl,
    cancelUrl,
    customerEmail: context.user.email,
  });

  return apiSuccess(
    {
      ...session,
      isLive: isLiveBillingConfigured(),
    },
    requestId,
    200,
  );
});
