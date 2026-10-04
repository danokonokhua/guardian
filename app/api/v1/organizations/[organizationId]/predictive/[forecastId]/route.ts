import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requireRole } from "@/lib/auth/context";
import { parseWith } from "@/lib/validation";
import { acknowledgeForecast } from "@/services/predictive/service";

const updateForecastStatusSchema = z.object({
  status: z.enum(["ACKNOWLEDGED", "RESOLVED", "DISMISSED"]),
});

export const PATCH = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId, forecastId } = params;
  if (!organizationId || !forecastId) {
    throw new Error("Missing organizationId or forecastId");
  }

  const context = await requireRole(organizationId, "ADMIN");
  const tenantScope = createTenantScope(context);

  const body = await request.json().catch(() => ({}));
  const validated = parseWith(updateForecastStatusSchema, body, "body");

  const updated = await acknowledgeForecast(
    tenantScope,
    forecastId,
    validated.status
  );

  return apiSuccess(updated, requestId);
});
