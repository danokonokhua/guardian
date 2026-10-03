import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { rejectRemediation } from "@/services/remediation/service";

const rejectSchema = z.object({
  reason: z.string().trim().default("Rejected by operator"),
});

export const POST = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId, actionId } = params;
  if (!organizationId || !actionId) throw new Error("Missing parameters.");

  const context = await requirePermission(organizationId, "issue:manage");
  const tenantScope = createTenantScope(context);

  const body = rejectSchema.parse(await request.json().catch(() => ({})));

  const action = await rejectRemediation(
    tenantScope,
    actionId,
    body.reason,
    context.user.userId,
  );

  return apiSuccess(action, requestId);
});

