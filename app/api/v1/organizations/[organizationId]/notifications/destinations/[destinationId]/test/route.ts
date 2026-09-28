import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { parseWith } from "@/lib/validation";
import { testDestination } from "@/services/notifications/destinations";
export const POST = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId, destinationId } = parseWith(
    z.object({ organizationId: z.string().uuid(), destinationId: z.string().uuid() }),
    params,
    "path",
  );
  const context = await requirePermission(organizationId, "org:update");
  return apiSuccess(await testDestination(createTenantScope(context), destinationId), requestId);
});
