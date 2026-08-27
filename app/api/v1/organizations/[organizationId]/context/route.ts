import { z } from "zod";

import { apiSuccess, withApiRoute } from "@/lib/api";
import { requireOrganizationMember, requireRole } from "@/lib/auth/context";
import { organizationContextSnapshot } from "@/services/organizations/service";
import { parseWith } from "@/lib/validation";

/**
 * `/api/v1/organizations/{organizationId}/context` — Phase 1B-06
 * ARCHITECTURAL TEST ENDPOINT (not a product feature).
 *
 * Proves the full mandated flow:
 *   HTTP → /api/v1 boundary → request context → identity (adapter) →
 *   membership → authorization → validation → service → response envelope.
 *
 * Security model:
 * - `organizationId` from the path is a LOOKUP KEY, never proof of
 *   authorization; authorization comes exclusively from the authenticated
 *   identity's membership (lib/auth/context.ts).
 * - `minimumRole` is the route declaring its own requirement (like a
 *   permission string) — it can only RAISE the bar, never grant access.
 * - Cross-tenant access fails closed as 404 (existence masking).
 */

const paramsSchema = z.object({
  organizationId: z.string().uuid(),
});

const querySchema = z.object({
  minimumRole: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]).optional(),
});

export const GET = withApiRoute(async (request, { requestId, params }) => {
  const { organizationId } = parseWith(paramsSchema, params, "path");
  const url = new URL(request.url);
  const query = parseWith(querySchema, Object.fromEntries(url.searchParams.entries()), "query");

  const context =
    query.minimumRole === undefined
      ? await requireOrganizationMember(organizationId)
      : await requireRole(organizationId, query.minimumRole);

  return apiSuccess(organizationContextSnapshot(context), requestId);
});
