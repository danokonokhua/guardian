import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { parseWith } from "@/lib/validation";
import { readIssueAnalytics } from "@/services/issues/analytics";

const paramsSchema = z.object({ organizationId: z.string().uuid() });
const querySchema = z.object({ format: z.enum(["csv", "json"]).default("csv") });

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export const GET = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId } = parseWith(paramsSchema, params, "path");
  const query = parseWith(
    querySchema,
    Object.fromEntries(new URL(request.url).searchParams.entries()),
    "query",
  );
  const context = await requirePermission(organizationId, "issue:read");
  const analytics = await readIssueAnalytics(createTenantScope(context));
  if (query.format === "json") return apiSuccess(analytics, requestId);
  const rows = [
    ["metric", "value"],
    ["mean_time_to_acknowledge_minutes", analytics.meanTimeToAcknowledgeMinutes],
    ["mean_time_to_resolve_minutes", analytics.meanTimeToResolveMinutes],
    ["acknowledge_sla_minutes", analytics.sla.acknowledgeMinutes],
    ["resolve_sla_minutes", analytics.sla.resolveMinutes],
    ["active_sla_breaches", analytics.sla.activeBreaches],
    ["acknowledge_breaches", analytics.sla.acknowledgeBreaches],
    ["resolve_breaches", analytics.sla.resolveBreaches],
    ...analytics.volumeTrend.map((point) => [`volume_${point.date}`, point.total]),
  ];
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  return new Response(`${csv}\n`, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="guardian-issue-analytics.csv"',
      "x-request-id": requestId,
    },
  });
});
