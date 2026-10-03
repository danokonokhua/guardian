import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission, requireRole } from "@/lib/auth/context";
import { parseWith } from "@/lib/validation";
import {
  createApiKey,
  getApiKeyOverview,
  listApiKeys,
} from "@/services/api-keys/service";

const createApiKeySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(64, "Name cannot exceed 64 characters"),
  scopes: z.array(z.string()).optional(),
  expiresInDays: z.number().int().positive().nullable().optional(),
});

export const GET = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId } = params;
  if (!organizationId) throw new Error("Missing organizationId");

  const context = await requirePermission(organizationId, "org:read");
  const tenantScope = createTenantScope(context);

  const overview = await getApiKeyOverview(tenantScope);
  return apiSuccess(overview, requestId);
});

export const POST = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId } = params;
  if (!organizationId) throw new Error("Missing organizationId");

  const context = await requireRole(organizationId, "ADMIN");
  const tenantScope = createTenantScope(context);

  const body = await request.json().catch(() => ({}));
  const validated = parseWith(createApiKeySchema, body, "body");

  const generated = await createApiKey(
    tenantScope,
    {
      name: validated.name,
      scopes: validated.scopes,
      expiresInDays: validated.expiresInDays,
      createdById: context.user.userId,
    }
  );

  return apiSuccess(generated, requestId, 201);
});
