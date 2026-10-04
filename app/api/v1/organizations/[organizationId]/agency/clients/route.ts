import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { registerAgencyClient } from "@/services/agency/service";

const addClientSchema = z.object({
  clientName: z.string().trim().min(1, "Client name is required"),
  clientDomain: z.string().trim().min(1, "Client domain is required"),
  contactEmail: z.string().trim().email().optional().nullable(),
  contactName: z.string().trim().optional().nullable(),
  monthlyRetainerCents: z.number().int().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const POST = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId } = params;
  if (!organizationId) throw new Error("Missing organizationId.");

  const context = await requirePermission(organizationId, "org:update");
  const tenantScope = createTenantScope(context);

  const body = addClientSchema.parse(await request.json().catch(() => ({})));

  const client = await registerAgencyClient(tenantScope, {
    clientName: body.clientName,
    clientDomain: body.clientDomain,
    contactEmail: body.contactEmail,
    contactName: body.contactName,
    monthlyRetainerCents: body.monthlyRetainerCents,
    notes: body.notes,
  });

  return apiSuccess(client, requestId, 201);
});
