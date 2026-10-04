import "server-only";

import type { TenantScope } from "@/db/tenant";
import { withTenantTransaction } from "@/db/tenant";

export const marketplaceInstallSelect = {
  id: true,
  organizationId: true,
  pluginId: true,
  status: true,
  config: true,
  installedById: true,
  lastSyncAt: true,
  lastError: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type MarketplaceInstallRecord = {
  id: string;
  organizationId: string;
  pluginId: string;
  status: string;
  config: unknown;
  installedById: string | null;
  lastSyncAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MarketplaceInstallWithCredentials = MarketplaceInstallRecord & {
  encryptedCredentials: string | null;
};

export async function listMarketplaceInstallsByOrg(
  scope: TenantScope
): Promise<MarketplaceInstallRecord[]> {
  return withTenantTransaction(scope, async (tx) =>
    tx.marketplaceInstall.findMany({
      where: { organizationId: scope.organizationId },
      select: marketplaceInstallSelect,
      orderBy: { createdAt: "desc" },
    })
  );
}

export async function findMarketplaceInstallByPluginId(
  scope: TenantScope,
  pluginId: string
): Promise<MarketplaceInstallWithCredentials | null> {
  return withTenantTransaction(scope, async (tx) =>
    tx.marketplaceInstall.findUnique({
      where: {
        organizationId_pluginId: {
          organizationId: scope.organizationId,
          pluginId,
        },
      },
    })
  );
}

export async function upsertMarketplaceInstallRecord(
  scope: TenantScope,
  data: {
    pluginId: string;
    status: string;
    config: Record<string, unknown>;
    encryptedCredentials?: string | null;
    installedById?: string | null;
    lastSyncAt?: Date | null;
    lastError?: string | null;
  }
): Promise<MarketplaceInstallRecord> {
  return withTenantTransaction(scope, async (tx) =>
    tx.marketplaceInstall.upsert({
      where: {
        organizationId_pluginId: {
          organizationId: scope.organizationId,
          pluginId: data.pluginId,
        },
      },
      create: {
        organizationId: scope.organizationId,
        pluginId: data.pluginId,
        status: data.status,
        config: data.config as any,
        encryptedCredentials: data.encryptedCredentials,
        installedById: data.installedById,
        lastSyncAt: data.lastSyncAt,
        lastError: data.lastError,
      },
      update: {
        status: data.status,
        config: data.config as any,
        ...(data.encryptedCredentials !== undefined
          ? { encryptedCredentials: data.encryptedCredentials }
          : {}),
        lastSyncAt: data.lastSyncAt,
        lastError: data.lastError,
      },
      select: marketplaceInstallSelect,
    })
  );
}

export async function updateMarketplaceInstallStatusRecord(
  scope: TenantScope,
  pluginId: string,
  status: string,
  lastError?: string | null
): Promise<MarketplaceInstallRecord> {
  return withTenantTransaction(scope, async (tx) =>
    tx.marketplaceInstall.update({
      where: {
        organizationId_pluginId: {
          organizationId: scope.organizationId,
          pluginId,
        },
      },
      data: {
        status,
        ...(lastError !== undefined ? { lastError } : {}),
      },
      select: marketplaceInstallSelect,
    })
  );
}

export async function deleteMarketplaceInstallRecord(
  scope: TenantScope,
  pluginId: string
): Promise<void> {
  await withTenantTransaction(scope, async (tx) =>
    tx.marketplaceInstall.deleteMany({
      where: {
        organizationId: scope.organizationId,
        pluginId,
      },
    })
  );
}
