import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { getBillingSummary, upsertSubscription, startTrial } from "@/services/billing/repository";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { BILLING_PLANS } from "@/config/billing-plans";
import type { Plan } from "@prisma/client";

export const GET = withApiRoute(async (_request, { params, requestId }) => {
  const organizationId = params.organizationId;
  if (!organizationId) throw new ValidationError("Missing organization id.");
  const context = await requirePermission(organizationId, "org:read");
  const summary = await getBillingSummary(createTenantScope(context));
  if (!summary) throw new NotFoundError("Organization not found.");
  return apiSuccess(summary, requestId);
});

export const POST = withApiRoute(async (request, { params, requestId }) => {
  const organizationId = params.organizationId;
  if (!organizationId) throw new ValidationError("Missing organization id.");
  const context = await requirePermission(organizationId, "org:update");
  const body = (await request.json().catch(() => ({}))) as {
    action?: "start_trial" | "change_plan";
    plan?: string;
    interval?: "MONTHLY" | "ANNUAL";
  };

  const scope = createTenantScope(context);

  if (body.action === "start_trial") {
    const targetPlan = (body.plan as Plan) || "PRO";
    const sub = await startTrial(scope, targetPlan);
    return apiSuccess(sub, requestId, 200);
  }

  if (body.action === "change_plan" && body.plan) {
    const validPlan = BILLING_PLANS.find((p) => p.id === body.plan);
    if (!validPlan) throw new ValidationError(`Invalid plan: ${body.plan}`);
    const sub = await upsertSubscription(scope, {
      plan: body.plan as Plan,
      interval: body.interval ?? "MONTHLY",
      status: "ACTIVE",
    });
    return apiSuccess(sub, requestId, 200);
  }

  throw new ValidationError("Invalid billing action. Expected 'start_trial' or 'change_plan'.");
});
