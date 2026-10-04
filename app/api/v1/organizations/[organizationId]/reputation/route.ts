import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { getReputationOverview, recordReview } from "@/services/reputation/service";

const ingestSchema = z.object({
  authorName: z.string().trim().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(1),
  source: z.string().default("DIRECT"),
  websiteId: z.string().optional().nullable(),
});

export const GET = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId } = params;
  if (!organizationId) throw new Error("Missing organizationId.");

  const context = await requirePermission(organizationId, "org:read");
  const tenantScope = createTenantScope(context);

  const url = new URL(request.url);
  const ratingParam = url.searchParams.get("rating");
  const sentimentParam = url.searchParams.get("sentiment");
  const hasReplyParam = url.searchParams.get("hasReply");
  const limitParam = url.searchParams.get("limit");
  const offsetParam = url.searchParams.get("offset");

  const filters = {
    rating: ratingParam ? Number.parseInt(ratingParam, 10) : undefined,
    sentiment: (sentimentParam as any) || undefined,
    hasReply: hasReplyParam !== null ? hasReplyParam === "true" : undefined,
    limit: limitParam ? Number.parseInt(limitParam, 10) : 25,
    offset: offsetParam ? Number.parseInt(offsetParam, 10) : 0,
  };

  const result = await getReputationOverview(tenantScope, filters);

  return apiSuccess(result, requestId);
});

export const POST = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId } = params;
  if (!organizationId) throw new Error("Missing organizationId.");

  const context = await requirePermission(organizationId, "org:update");
  const tenantScope = createTenantScope(context);

  const body = ingestSchema.parse(await request.json().catch(() => ({})));

  const review = await recordReview(tenantScope, body);

  return apiSuccess(review, requestId, 201);
});
