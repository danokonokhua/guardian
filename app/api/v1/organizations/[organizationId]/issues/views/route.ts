import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { parseWith } from "@/lib/validation";
import { listSavedIssueViews, saveIssueView } from "@/services/issues/service";

const paramsSchema = z.object({ organizationId: z.string().uuid() });

export const GET = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId } = parseWith(paramsSchema, params, "path");
  const context = await requirePermission(organizationId, "issue:read");
  return apiSuccess(await listSavedIssueViews(createTenantScope(context)), requestId);
});

export const POST = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId } = parseWith(paramsSchema, params, "path");
  const context = await requirePermission(organizationId, "issue:manage");
  return apiSuccess(
    await saveIssueView(createTenantScope(context), await request.json()),
    requestId,
    201,
  );
});
