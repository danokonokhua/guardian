import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { parseWith } from "@/lib/validation";
import { upsertPushSubscriptionRecord } from "@/services/mobile/repository";

const subscribeSchema = z.object({
  endpoint: z.string().url("Valid push service URL is required"),
  keys: z.object({
    p256dh: z.string().min(1, "p256dh key is required"),
    auth: z.string().min(1, "auth key is required"),
  }),
  userAgent: z.string().optional().nullable(),
});

export const POST = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId } = params;
  if (!organizationId) throw new Error("Missing organizationId");

  const context = await requirePermission(organizationId, "org:read");
  const tenantScope = createTenantScope(context);

  const body = await request.json().catch(() => ({}));
  const validated = parseWith(subscribeSchema, body, "body");

  const record = await upsertPushSubscriptionRecord(tenantScope, validated);

  return apiSuccess(
    {
      subscribed: true,
      deviceId: record.id,
      endpoint: record.endpoint,
    },
    requestId,
    201
  );
});

