import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { parseWith } from "@/lib/validation";
import { enqueueSlaEscalations } from "@/services/issues/escalation";

const paramsSchema = z.object({ organizationId: z.string().uuid() });

export const POST = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId } = parseWith(paramsSchema, params, "path");
  const context = await requirePermission(organizationId, "issue:manage");
  return apiSuccess(await enqueueSlaEscalations(createTenantScope(context)), requestId, 202);
});
