import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { parseWith } from "@/lib/validation";
import { listOrganizationIssues } from "@/services/issues/service";

const paramsSchema = z.object({ organizationId: z.string().uuid() });
const querySchema = z.object({
  status: z
    .enum(["ACTIVE", "OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED", "IGNORED"])
    .optional(),
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]).optional(),
  sort: z.enum(["lastSeenAt", "severity", "status"]).default("lastSeenAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const GET = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId } = parseWith(paramsSchema, params, "path");
  const query = parseWith(
    querySchema,
    Object.fromEntries(new URL(request.url).searchParams.entries()),
    "query",
  );
  const context = await requirePermission(organizationId, "issue:read");
  return apiSuccess(
    await listOrganizationIssues(createTenantScope(context), {
      status: query.status,
      severity: query.severity,
      orderBy: query.sort,
      order: query.order,
      cursor: query.cursor,
      limit: query.limit,
    }),
    requestId,
  );
});
