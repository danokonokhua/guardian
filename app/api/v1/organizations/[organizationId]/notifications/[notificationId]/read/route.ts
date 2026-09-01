import { z } from "zod";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requireOrganizationMember } from "@/lib/auth/context";
import { createTenantScope } from "@/db/tenant";
import { markInAppNotificationRead } from "@/services/notifications/repository";
import { parseWith } from "@/lib/validation";
import { NotFoundError } from "@/lib/errors";

const paramsSchema = z.object({
  organizationId: z.string().uuid(),
  notificationId: z.string().uuid(),
});

export const PATCH = withApiRoute(async (_request, { requestId, params }) => {
  const { organizationId, notificationId } = parseWith(paramsSchema, params, "path");
  const context = await requireOrganizationMember(organizationId);
  const result = await markInAppNotificationRead(
    createTenantScope(context),
    context.user.userId,
    notificationId,
  );
  if (result.count !== 1) {
    // Mask missing, cross-user, and cross-tenant notification IDs alike.
    throw new NotFoundError("Notification");
  }
  return apiSuccess({ updated: result.count === 1 }, requestId);
});
