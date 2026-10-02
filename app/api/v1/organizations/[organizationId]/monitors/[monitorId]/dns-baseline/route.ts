import { z } from "zod";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import { createTenantScope, withTenantTransaction } from "@/db/tenant";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { parseWith } from "@/lib/validation";
import { DNS_RECORD_TYPES, type DnsSnapshot } from "@/lib/dns/records";
export const POST = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId, monitorId } = parseWith(
    z.object({ organizationId: z.string().uuid(), monitorId: z.string().uuid() }),
    params,
    "path",
  );
  const { observedAt } = parseWith(
    z.object({ observedAt: z.string().datetime() }).strict(),
    await request.json(),
    "body",
  );
  const context = await requirePermission(organizationId, "monitoring:manage");
  await withTenantTransaction(createTenantScope(context), async (tx) => {
    await tx.$queryRaw`SELECT id FROM monitoring_checks WHERE id = ${monitorId} AND "organizationId" = ${organizationId} FOR UPDATE`;
    const monitor = await tx.monitor.findFirst({
      where: { id: monitorId, organizationId, type: "DNS" },
    });
    if (!monitor) throw new NotFoundError("DNS monitor");
    const config = monitor.config as {
      latest?: DnsSnapshot;
      baseline?: Record<string, string[]>;
      observedAt?: string;
    };
    if (
      config.observedAt !== observedAt ||
      !config.latest ||
      DNS_RECORD_TYPES.some((type) => config.latest![type].state !== "OK")
    )
      throw new ConflictError(
        "DNS evidence changed or is incomplete. Refresh and inspect it before accepting.",
      );
    const baseline = Object.fromEntries(
      DNS_RECORD_TYPES.map((type) => [
        type,
        (config.latest![type] as { state: "OK"; records: string[] }).records,
      ]),
    );
    await tx.monitor.update({
      where: { id: monitorId },
      data: {
        config: {
          ...config,
          baseline,
          acceptedBy: context.user.userId,
          acceptedAt: new Date().toISOString(),
        },
      },
    });
    await tx.monitoringResult.create({
      data: {
        organizationId,
        websiteId: monitor.websiteId,
        monitorId,
        status: "UP",
        details: {
          checkType: "DNS_BASELINE_ACCEPTED",
          actor: context.user.userId,
          previous: JSON.stringify(config.baseline ?? {}),
          baseline: JSON.stringify(baseline),
          observedAt,
        },
      },
    });
  });
  return apiSuccess({ accepted: true }, requestId);
});
