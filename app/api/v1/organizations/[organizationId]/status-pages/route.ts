import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { parseWith } from "@/lib/validation";
import { createStatusPage, listStatusPages } from "@/services/status-pages";
const schema = z.object({ organizationId: z.string().uuid() });
export const GET = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId } = parseWith(schema, params, "path");
  return apiSuccess(
    await listStatusPages(createTenantScope(await requirePermission(organizationId, "org:read"))),
    requestId,
  );
});
export const POST = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId } = parseWith(schema, params, "path");
  const scope = createTenantScope(await requirePermission(organizationId, "org:update"));
  return apiSuccess(await createStatusPage(scope, await request.json()), requestId, 201);
});
