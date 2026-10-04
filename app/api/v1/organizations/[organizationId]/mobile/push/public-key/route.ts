import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { getVapidPublicKey } from "@/services/mobile/vapid";

export const GET = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId } = params;
  if (!organizationId) throw new Error("Missing organizationId");

  await requirePermission(organizationId, "org:read");

  return apiSuccess({ vapidPublicKey: getVapidPublicKey() }, requestId);
});
