import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requireRole } from "@/lib/auth/context";
import { NotFoundError } from "@/lib/errors";
import { revokeApiKey } from "@/services/api-keys/service";

export const DELETE = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId, keyId } = params;
  if (!organizationId || !keyId) throw new Error("Missing parameters");

  const context = await requireRole(organizationId, "ADMIN");
  const tenantScope = createTenantScope(context);

  const revoked = await revokeApiKey(tenantScope, keyId);
  if (!revoked) {
    throw new NotFoundError("ApiKey");
  }

  return apiSuccess(revoked, requestId);
});
