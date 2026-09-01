import { z } from "zod";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requireOrganizationMember } from "@/lib/auth/context";
import { createTenantScope } from "@/db/tenant";
import { listInAppNotifications } from "@/services/notifications/repository";
import { parseWith } from "@/lib/validation";

const paramsSchema = z.object({ organizationId: z.string().uuid() });

export const GET = withApiRoute(async (_request, { requestId, params }) => {
  const { organizationId } = parseWith(paramsSchema, params, "path");
  const context = await requireOrganizationMember(organizationId);
  const rows = await listInAppNotifications(createTenantScope(context), context.user.userId);
  return apiSuccess(rows, requestId);
});
