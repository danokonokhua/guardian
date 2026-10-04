import "server-only";

import { getPrisma } from "@/db/client";
import { syncGoogleIntegration } from "@/services/integrations/google/service";
import type { TenantScope } from "@/db/tenant";

export async function runGoogleIntegrationsSync(): Promise<{
  synced: number;
  errors: number;
}> {
  const prisma = getPrisma();
  const integrations = await prisma.googleIntegration.findMany({
    where: { status: "CONNECTED" },
    select: { id: true, organizationId: true, provider: true },
  });

  let synced = 0;
  let errors = 0;

  for (const item of integrations) {
    const scope: TenantScope = {
      organizationId: item.organizationId,
      userId: "system-cron",
      role: "OWNER",
    };

    try {
      await syncGoogleIntegration(scope, item.id);
      synced++;
    } catch {
      errors++;
    }
  }

  return { synced, errors };
}
