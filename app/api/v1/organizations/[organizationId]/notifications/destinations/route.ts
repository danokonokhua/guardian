import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { parseWith } from "@/lib/validation";
import { ValidationError } from "@/lib/errors";
import { createDestination, listDestinations } from "@/services/notifications/destinations";
const paramsSchema = z.object({ organizationId: z.string().uuid() });
export const GET = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId } = parseWith(paramsSchema, params, "path");
  const context = await requirePermission(organizationId, "org:update");
  return apiSuccess(await listDestinations(createTenantScope(context)), requestId);
});
export const POST = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId } = parseWith(paramsSchema, params, "path");
  const context = await requirePermission(organizationId, "org:update");
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    // JSON parser errors can include fragments of the secret webhook URL.
    throw new ValidationError("Request body must be valid JSON.");
  }
  return apiSuccess(await createDestination(createTenantScope(context), input), requestId);
});
