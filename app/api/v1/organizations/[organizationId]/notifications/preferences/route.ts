import { z } from "zod";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requireOrganizationMember } from "@/lib/auth/context";
import { createTenantScope } from "@/db/tenant";
import { isChannelEnabled, setPreference } from "@/services/notifications/repository";
import { parseWith } from "@/lib/validation";
const paramsSchema = z.object({ organizationId: z.string().uuid() });
const inputSchema = z
  .object({ channel: z.enum(["IN_APP", "EMAIL"]), enabled: z.boolean() })
  .strict();
export const GET = withApiRoute(async (_request, { params, requestId }) => {
  const { organizationId } = parseWith(paramsSchema, params, "path");
  const context = await requireOrganizationMember(organizationId);
  const scope = createTenantScope(context);
  const [IN_APP, EMAIL] = await Promise.all([
    isChannelEnabled(scope, context.user.userId, "ISSUE", "IN_APP"),
    isChannelEnabled(scope, context.user.userId, "ISSUE", "EMAIL"),
  ]);
  return apiSuccess({ IN_APP, EMAIL }, requestId);
});
export const PATCH = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId } = parseWith(paramsSchema, params, "path");
  const context = await requireOrganizationMember(organizationId);
  const input = parseWith(inputSchema, await request.json(), "body");
  await setPreference(
    createTenantScope(context),
    context.user.userId,
    "ISSUE",
    input.channel,
    input.enabled,
  );
  return apiSuccess(input, requestId);
});
