import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { parseWith } from "@/lib/validation";
import {
  readOrganizationSlaPolicy,
  slaPolicySchema,
  updateOrganizationSlaPolicy,
} from "@/services/organizations/settings";

const paramsSchema = z.object({ organizationId: z.string().uuid() });

export const GET = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId } = parseWith(paramsSchema, params, "path");
  const context = await requirePermission(organizationId, "issue:read");
  return apiSuccess(await readOrganizationSlaPolicy(createTenantScope(context)), requestId);
});

export const PATCH = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId } = parseWith(paramsSchema, params, "path");
  const context = await requirePermission(organizationId, "issue:manage");
  const body = await request.json();
  const policy = parseWith(slaPolicySchema, body, "body");
  return apiSuccess(
    await updateOrganizationSlaPolicy(createTenantScope(context), policy),
    requestId,
  );
});
