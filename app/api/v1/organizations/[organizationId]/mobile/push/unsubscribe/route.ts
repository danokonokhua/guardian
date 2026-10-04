import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { parseWith } from "@/lib/validation";
import { deletePushSubscriptionRecord } from "@/services/mobile/repository";

const unsubscribeSchema = z.object({
  endpoint: z.string().url("Valid push service URL is required"),
});

export const POST = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId } = params;
  if (!organizationId) throw new Error("Missing organizationId");

  const context = await requirePermission(organizationId, "org:read");
  const tenantScope = createTenantScope(context);

  const body = await request.json().catch(() => ({}));
  const validated = parseWith(unsubscribeSchema, body, "body");

  const deleted = await deletePushSubscriptionRecord(tenantScope, validated.endpoint);

  return apiSuccess({ unsubscribed: deleted }, requestId);
});
