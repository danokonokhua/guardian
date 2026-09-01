import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { parseWith } from "@/lib/validation";
import { readIssueAnalytics } from "@/services/issues/analytics";

const paramsSchema = z.object({ organizationId: z.string().uuid() });

export const GET = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId } = parseWith(paramsSchema, params, "path");
  const context = await requirePermission(organizationId, "issue:read");
  return apiSuccess(await readIssueAnalytics(createTenantScope(context)), requestId);
});
