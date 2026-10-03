import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import {
  generateAiDraft,
  submitReviewReply,
} from "@/services/reputation/service";

const replySchema = z.object({
  replyText: z.string().trim().min(1),
});

export const POST = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId, reviewId } = params;
  if (!organizationId || !reviewId) {
    throw new Error("Missing organizationId or reviewId.");
  }

  const context = await requirePermission(organizationId, "org:update");
  const tenantScope = createTenantScope(context);

  const updatedReview = await generateAiDraft(tenantScope, reviewId);

  return apiSuccess(updatedReview, requestId);
});

export const PATCH = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId, reviewId } = params;
  if (!organizationId || !reviewId) {
    throw new Error("Missing organizationId or reviewId.");
  }

  const context = await requirePermission(organizationId, "org:update");
  const tenantScope = createTenantScope(context);

  const body = replySchema.parse(await request.json().catch(() => ({})));

  const updatedReview = await submitReviewReply(
    tenantScope,
    reviewId,
    body.replyText,
  );

  return apiSuccess(updatedReview, requestId);
});
