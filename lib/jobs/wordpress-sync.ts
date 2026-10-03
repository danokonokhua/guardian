import "server-only";

import { getPrisma } from "@/db/client";
import { syncWordpressSite } from "@/services/integrations/wordpress/service";
import type { TenantScope } from "@/db/tenant";

export async function runWordpressIntegrationsSync(): Promise<{
  synced: number;
  errors: number;
}> {
  const prisma = getPrisma();
  const connections = await prisma.wordpressConnection.findMany({
    where: { status: "CONNECTED" },
    select: { websiteId: true, organizationId: true },
  });

  let synced = 0;
  let errors = 0;

  for (const item of connections) {
    const scope: TenantScope = {
      organizationId: item.organizationId,
      userId: "system-cron",
      role: "OWNER",
    };

    try {
      await syncWordpressSite(scope, item.websiteId);
      synced++;
    } catch {
      errors++;
    }
  }

  return { synced, errors };
}
