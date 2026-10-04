import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requireRole } from "@/lib/auth/context";
import { parseWith } from "@/lib/validation";
import { executeCooDirective } from "@/services/ai-coo/service";

const executeDirectiveSchema = z.object({
  action: z.enum(["APPROVE", "EXECUTE", "DISMISS"]),
});

export const POST = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId, directiveId } = params;
  if (!organizationId || !directiveId) {
    throw new Error("Missing organizationId or directiveId");
  }

  const context = await requireRole(organizationId, "ADMIN");
  const tenantScope = createTenantScope(context);

  const body = await request.json().catch(() => ({}));
  const validated = parseWith(executeDirectiveSchema, body, "body");

  const result = await executeCooDirective(tenantScope, directiveId, validated.action);

  return apiSuccess(result, requestId);
});
