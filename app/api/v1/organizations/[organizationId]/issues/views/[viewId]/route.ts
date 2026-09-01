import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { parseWith } from "@/lib/validation";
import { removeSavedIssueView } from "@/services/issues/service";

const paramsSchema = z.object({ organizationId: z.string().uuid(), viewId: z.string().uuid() });

export const DELETE = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId, viewId } = parseWith(paramsSchema, params, "path");
  const context = await requirePermission(organizationId, "issue:manage");
  await removeSavedIssueView(createTenantScope(context), viewId);
  return apiSuccess({ deleted: true }, requestId);
});
