import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { parseWith } from "@/lib/validation";
import { updateDestination, deleteDestination } from "@/services/notifications/destinations";
const paramsSchema = z.object({
  organizationId: z.string().uuid(),
  destinationId: z.string().uuid(),
});
export const PATCH = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId, destinationId } = parseWith(paramsSchema, params, "path");
  const context = await requirePermission(organizationId, "org:update");
  return apiSuccess(
    await updateDestination(createTenantScope(context), destinationId, await request.json()),
    requestId,
  );
});
export const DELETE = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId, destinationId } = parseWith(paramsSchema, params, "path");
  const context = await requirePermission(organizationId, "org:update");
  return apiSuccess(await deleteDestination(createTenantScope(context), destinationId), requestId);
});
