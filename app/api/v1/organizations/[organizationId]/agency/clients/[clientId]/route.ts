import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { findAgencyClientById } from "@/services/agency/repository";
import { updateAgencyClientDetails, removeAgencyClient } from "@/services/agency/service";
import { NotFoundError } from "@/lib/errors";

const updateSchema = z.object({
  clientName: z.string().trim().min(1).optional(),
  contactEmail: z.string().trim().email().optional().nullable(),
  contactName: z.string().trim().optional().nullable(),
  status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]).optional(),
  monthlyRetainerCents: z.number().int().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const GET = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId, clientId } = params;
  if (!organizationId || !clientId) throw new Error("Missing parameters.");

  const context = await requirePermission(organizationId, "org:read");
  const tenantScope = createTenantScope(context);

  const client = await findAgencyClientById(tenantScope, clientId);
  if (!client) throw new NotFoundError(`Client ${clientId} not found`);

  return apiSuccess(client, requestId);
});

export const PATCH = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId, clientId } = params;
  if (!organizationId || !clientId) throw new Error("Missing parameters.");

  const context = await requirePermission(organizationId, "org:update");
  const tenantScope = createTenantScope(context);

  const body = updateSchema.parse(await request.json().catch(() => ({})));

  const updated = await updateAgencyClientDetails(tenantScope, clientId, body);

  return apiSuccess(updated, requestId);
});

export const DELETE = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId, clientId } = params;
  if (!organizationId || !clientId) throw new Error("Missing parameters.");

  const context = await requirePermission(organizationId, "org:update");
  const tenantScope = createTenantScope(context);

  await removeAgencyClient(tenantScope, clientId);

  return apiSuccess({ deleted: true }, requestId);
});
