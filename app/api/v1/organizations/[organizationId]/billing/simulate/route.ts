import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { ValidationError } from "@/lib/errors";
import { POST as simulatePOST } from "@/app/api/webhooks/stripe/simulate/route";
import type { Plan, BillingInterval } from "@prisma/client";

export const dynamic = "force-dynamic";

export const POST = withApiRoute(async (request, { params, requestId }) => {
  const organizationId = params.organizationId;
  if (!organizationId) throw new ValidationError("Missing organization id.");
  await requirePermission(organizationId, "org:update");

  const body = (await request.json().catch(() => ({}))) as {
    eventType?: string;
    plan?: Plan;
    amountCents?: number;
    interval?: BillingInterval;
  };

  const simulateReq = new Request("http://localhost:3000/api/webhooks/stripe/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      organizationId,
      eventType: body.eventType,
      plan: body.plan,
      amountCents: body.amountCents,
      interval: body.interval,
    }),
  });

  const res = await simulatePOST(simulateReq);
  const data = await res.json();
  return apiSuccess(data, requestId, res.status);
});
