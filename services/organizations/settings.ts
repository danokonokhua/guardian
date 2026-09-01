import "server-only";

import { z } from "zod";
import type { TenantScope } from "@/db/tenant";
import { withTenantTransaction } from "@/db/tenant";

export const DEFAULT_SLA_POLICY = Object.freeze({
  acknowledgeMinutes: 60,
  resolveMinutes: 24 * 60,
});
export const slaPolicySchema = z.object({
  acknowledgeMinutes: z.coerce.number().int().min(1).max(10_080),
  resolveMinutes: z.coerce.number().int().min(1).max(43_200),
});
export type SlaPolicy = z.infer<typeof slaPolicySchema>;

function readStoredPolicy(settings: unknown): SlaPolicy {
  if (typeof settings !== "object" || settings === null || !("sla" in settings)) {
    return { ...DEFAULT_SLA_POLICY };
  }
  const result = slaPolicySchema.safeParse((settings as { sla?: unknown }).sla);
  return result.success ? result.data : { ...DEFAULT_SLA_POLICY };
}

export function readOrganizationSlaPolicy(scope: TenantScope): Promise<SlaPolicy> {
  return withTenantTransaction(scope, async (tx) => {
    const organization = await tx.organization.findUnique({
      where: { id: scope.organizationId },
      select: { settings: true },
    });
    return readStoredPolicy(organization?.settings);
  });
}

export function updateOrganizationSlaPolicy(
  scope: TenantScope,
  policy: unknown,
): Promise<SlaPolicy> {
  const parsed = slaPolicySchema.parse(policy);
  return withTenantTransaction(scope, async (tx) => {
    const organization = await tx.organization.findUnique({
      where: { id: scope.organizationId },
      select: { settings: true },
    });
    const existing =
      typeof organization?.settings === "object" && organization.settings !== null
        ? organization.settings
        : {};
    await tx.organization.update({
      where: { id: scope.organizationId },
      data: { settings: { ...(existing as Record<string, unknown>), sla: parsed } },
    });
    return parsed;
  });
}
