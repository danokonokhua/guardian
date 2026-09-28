import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { parseWith } from "@/lib/validation";
import { editStatusPage, statusAudit } from "@/services/status-pages";
const schema = z.object({ organizationId: z.string().uuid(), pageId: z.string().uuid() });
export const PATCH = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId, pageId } = parseWith(schema, params, "path");
  const scope = createTenantScope(await requirePermission(organizationId, "org:update"));
  return apiSuccess(await editStatusPage(scope, pageId, await request.json()), requestId);
});
export const GET = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId, pageId } = parseWith(schema, params, "path");
  return apiSuccess(
    await statusAudit(
      createTenantScope(await requirePermission(organizationId, "org:update")),
      pageId,
    ),
    requestId,
  );
});
