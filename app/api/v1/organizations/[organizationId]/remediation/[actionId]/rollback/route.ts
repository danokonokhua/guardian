import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { rollbackRemediation } from "@/services/remediation/service";

const rollbackSchema = z.object({
  reason: z.string().trim().default("Triggered by operator"),
});

export const POST = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId, actionId } = params;
  if (!organizationId || !actionId) throw new Error("Missing parameters.");

  const context = await requirePermission(organizationId, "issue:manage");
  const tenantScope = createTenantScope(context);

  const body = rollbackSchema.parse(await request.json().catch(() => ({})));

  const action = await rollbackRemediation(
    tenantScope,
    actionId,
    body.reason,
    context.user.userId,
  );

  return apiSuccess(action, requestId);
});

