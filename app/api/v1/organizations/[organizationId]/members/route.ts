import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { parseWith } from "@/lib/validation";
import { listActiveOrganizationMembers } from "@/services/members/repository";

const paramsSchema = z.object({ organizationId: z.string().uuid() });

export const GET = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId } = parseWith(paramsSchema, params, "path");
  const context = await requirePermission(organizationId, "member:read");
  return apiSuccess(await listActiveOrganizationMembers(createTenantScope(context)), requestId);
});
