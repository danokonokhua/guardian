import "server-only";

import type { TenantScope } from "@/db/tenant";
import { assertCanUseMarketplace } from "@/lib/billing/entitlements";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { MARKETPLACE_CATALOG, getPluginById, type MarketplacePlugin } from "./catalog";
import { encryptPluginCredentials, decryptPluginCredentials } from "./crypto";
import {
  listMarketplaceInstallsByOrg,
  findMarketplaceInstallByPluginId,
  upsertMarketplaceInstallRecord,
  updateMarketplaceInstallStatusRecord,
  deleteMarketplaceInstallRecord,
  type MarketplaceInstallRecord,
} from "./repository";

export interface InstalledPluginSummary {
  plugin: MarketplacePlugin;
  install: MarketplaceInstallRecord | null;
  isInstalled: boolean;
  status: string; // "ACTIVE" | "PAUSED" | "ERROR" | "NOT_INSTALLED"
}

export interface MarketplaceOverview {
  catalogCount: number;
  installedCount: number;
  activeCount: number;
  plugins: InstalledPluginSummary[];
}

/**
 * Lists the full Marketplace plugin catalog decorated with tenant installation status.
 */
export async function getMarketplaceCatalog(
  scope: TenantScope,
  planId?: string,
): Promise<MarketplaceOverview> {
  const installs = await listMarketplaceInstallsByOrg(scope);
  const installMap = new Map(installs.map((inst) => [inst.pluginId, inst]));

  const plugins: InstalledPluginSummary[] = MARKETPLACE_CATALOG.map((plugin) => {
    const install = installMap.get(plugin.id) || null;
    return {
      plugin,
      install,
      isInstalled: !!install,
      status: install ? install.status : "NOT_INSTALLED",
    };
  });

  const installedCount = installs.length;
  const activeCount = installs.filter((i) => i.status === "ACTIVE").length;

  return {
    catalogCount: MARKETPLACE_CATALOG.length,
    installedCount,
    activeCount,
    plugins,
  };
}

/**
 * Installs or updates a plugin in the organization, validating required plan and encrypting credentials.
 */
export async function installMarketplacePlugin(
  scope: TenantScope,
  data: {
    pluginId: string;
    config: Record<string, unknown>;
    credentials?: Record<string, unknown>;
  },
  planId?: string,
): Promise<MarketplaceInstallRecord> {
  let effectivePlan = planId;
  if (!effectivePlan) {
    const { withTenantTransaction } = await import("@/db/tenant");
    const org = await withTenantTransaction(scope, async (tx) =>
      tx.organization.findUnique({
        where: { id: scope.organizationId },
        select: { plan: true },
      }),
    );
    effectivePlan = org?.plan ?? "PRO";
  }

  // Plan entitlement check
  assertCanUseMarketplace(effectivePlan);

  const plugin = getPluginById(data.pluginId);
  if (!plugin) {
    throw new NotFoundError(`Marketplace plugin '${data.pluginId}' not found.`);
  }

  // Check specific plugin plan requirement if any
  if (plugin.requiredPlan) {
    const tierRanks: Record<string, number> = {
      FREE: 0,
      STARTER: 1,
      GROWTH: 2,
      PRO: 3,
      AGENCY: 4,
      WHITE_LABEL: 5,
      ENTERPRISE: 6,
    };
    const currentRank = tierRanks[effectivePlan.toUpperCase()] ?? 0;
    const requiredRank = tierRanks[plugin.requiredPlan] ?? 0;
    if (currentRank < requiredRank) {
      throw new ConflictError(
        `The plugin '${plugin.name}' requires a ${plugin.requiredPlan} plan or higher.`,
      );
    }
  }

  // Validate required configuration fields
  for (const field of plugin.fields) {
    if (field.required) {
      const val = field.isSecret ? data.credentials?.[field.name] : data.config?.[field.name];
      if (val === undefined || val === null || val === "") {
        throw new ValidationError(`Field '${field.label}' is required.`);
      }
    }
  }

  // Encrypt secrets if provided
  let encryptedCredentials: string | null | undefined = undefined;
  if (data.credentials && Object.keys(data.credentials).length > 0) {
    encryptedCredentials = encryptPluginCredentials(
      data.credentials,
      `${scope.organizationId}:${plugin.id}`,
    );
  }

  return upsertMarketplaceInstallRecord(scope, {
    pluginId: plugin.id,
    status: "ACTIVE",
    config: data.config,
    encryptedCredentials,
    installedById: scope.userId,
    lastSyncAt: new Date(),
    lastError: null,
  });
}

/**
 * Updates plugin operational status (ACTIVE, PAUSED, DISABLED).
 */
export async function setPluginStatus(
  scope: TenantScope,
  pluginId: string,
  status: "ACTIVE" | "PAUSED" | "DISABLED",
): Promise<MarketplaceInstallRecord> {
  const existing = await findMarketplaceInstallByPluginId(scope, pluginId);
  if (!existing) {
    throw new NotFoundError(`Plugin '${pluginId}' is not installed.`);
  }

  return updateMarketplaceInstallStatusRecord(scope, pluginId, status, null);
}

/**
 * Uninstalls a plugin from the organization.
 */
export async function uninstallMarketplacePlugin(
  scope: TenantScope,
  pluginId: string,
): Promise<void> {
  const existing = await findMarketplaceInstallByPluginId(scope, pluginId);
  if (!existing) {
    throw new NotFoundError(`Plugin '${pluginId}' is not installed.`);
  }

  await deleteMarketplaceInstallRecord(scope, pluginId);
}

/**
 * Dispatches a simulated test event or payload through the installed plugin.
 */
export async function testMarketplacePlugin(
  scope: TenantScope,
  pluginId: string,
): Promise<{
  success: boolean;
  message: string;
  deliveredPayload?: Record<string, unknown>;
}> {
  const existing = await findMarketplaceInstallByPluginId(scope, pluginId);
  if (!existing) {
    throw new NotFoundError(`Plugin '${pluginId}' is not installed.`);
  }

  const plugin = getPluginById(pluginId);
  if (!plugin) {
    throw new NotFoundError(`Plugin specification not found.`);
  }

  // If plugin has encrypted credentials, verify they can be decrypted
  let decryptedCreds: Record<string, unknown> = {};
  if (existing.encryptedCredentials) {
    decryptedCreds = decryptPluginCredentials(
      existing.encryptedCredentials,
      `${scope.organizationId}:${pluginId}`,
    );
  }

  // Update sync timestamp
  await upsertMarketplaceInstallRecord(scope, {
    pluginId,
    status: existing.status === "ERROR" ? "ACTIVE" : existing.status,
    config: existing.config as Record<string, unknown>,
    lastSyncAt: new Date(),
    lastError: null,
  });

  return {
    success: true,
    message: `Test signal delivered successfully to ${plugin.name}.`,
    deliveredPayload: {
      pluginId,
      status: "ACTIVE",
      timestamp: new Date().toISOString(),
      recipientConfig: existing.config,
      credentialsConfigured: Object.keys(decryptedCreds).length > 0,
    },
  };
}
