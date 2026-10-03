import "server-only";

import type { WordpressConnectionStatus, Prisma } from "@prisma/client";
import type { TenantScope } from "@/db/tenant";
import { withTenantTransaction } from "@/db/tenant";
import { getPrisma } from "@/db/client";

export interface WordpressConnectionRecord {
  id: string;
  organizationId: string;
  websiteId: string;
  siteUrl: string;
  tokenEncrypted: string;
  tokenPrefix: string;
  status: WordpressConnectionStatus;
  wpVersion: string | null;
  phpVersion: string | null;
  serverSoftware: string | null;
  debugMode: boolean;
  httpsEnforced: boolean;
  updatesAvailable: Prisma.JsonValue;
  plugins: Prisma.JsonValue;
  themes: Prisma.JsonValue;
  lastSyncAt: Date | null;
  lastError: string | null;
  isSandbox: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const select = {
  id: true,
  organizationId: true,
  websiteId: true,
  siteUrl: true,
  tokenEncrypted: true,
  tokenPrefix: true,
  status: true,
  wpVersion: true,
  phpVersion: true,
  serverSoftware: true,
  debugMode: true,
  httpsEnforced: true,
  updatesAvailable: true,
  plugins: true,
  themes: true,
  lastSyncAt: true,
  lastError: true,
  isSandbox: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function listWordpressConnections(
  scope: TenantScope,
): Promise<WordpressConnectionRecord[]> {
  return withTenantTransaction(scope, async (tx) =>
    tx.wordpressConnection.findMany({
      where: { organizationId: scope.organizationId },
      select,
      orderBy: { createdAt: "desc" },
    }),
  );
}

export function findWordpressConnection(
  scope: TenantScope,
  websiteId: string,
): Promise<WordpressConnectionRecord | null> {
  return withTenantTransaction(scope, async (tx) =>
    tx.wordpressConnection.findFirst({
      where: { organizationId: scope.organizationId, websiteId },
      select,
    }),
  );
}

/**
 * Global unauthenticated lookup by token prefix for inbound webhook pairing.
 * System-level lookup before tenant context is established.
 */
export async function findWordpressConnectionByPrefix(
  tokenPrefix: string,
): Promise<WordpressConnectionRecord | null> {
  const prisma = getPrisma();
  return prisma.wordpressConnection.findFirst({
    where: { tokenPrefix },
    select,
  });
}

export interface UpsertWordpressConnectionInput {
  websiteId: string;
  siteUrl: string;
  tokenEncrypted: string;
  tokenPrefix: string;
  status?: WordpressConnectionStatus;
  isSandbox?: boolean;
  wpVersion?: string | null;
  phpVersion?: string | null;
  serverSoftware?: string | null;
  debugMode?: boolean;
  httpsEnforced?: boolean;
  updatesAvailable?: Prisma.InputJsonValue;
  plugins?: Prisma.InputJsonValue;
  themes?: Prisma.InputJsonValue;
}

export function upsertWordpressConnection(
  scope: TenantScope,
  input: UpsertWordpressConnectionInput,
): Promise<WordpressConnectionRecord> {
  return withTenantTransaction(scope, async (tx) => {
    return tx.wordpressConnection.upsert({
      where: { websiteId: input.websiteId },
      create: {
        organizationId: scope.organizationId,
        websiteId: input.websiteId,
        siteUrl: input.siteUrl,
        tokenEncrypted: input.tokenEncrypted,
        tokenPrefix: input.tokenPrefix,
        status: input.status ?? "CONNECTED",
        isSandbox: input.isSandbox ?? false,
        wpVersion: input.wpVersion ?? null,
        phpVersion: input.phpVersion ?? null,
        serverSoftware: input.serverSoftware ?? null,
        debugMode: input.debugMode ?? false,
        httpsEnforced: input.httpsEnforced ?? true,
        updatesAvailable: input.updatesAvailable,
        plugins: input.plugins,
        themes: input.themes,
        lastSyncAt: new Date(),
      },
      update: {
        siteUrl: input.siteUrl,
        tokenEncrypted: input.tokenEncrypted,
        tokenPrefix: input.tokenPrefix,
        status: input.status ?? "CONNECTED",
        isSandbox: input.isSandbox ?? false,
        ...(input.wpVersion !== undefined ? { wpVersion: input.wpVersion } : {}),
        ...(input.phpVersion !== undefined ? { phpVersion: input.phpVersion } : {}),
        ...(input.serverSoftware !== undefined ? { serverSoftware: input.serverSoftware } : {}),
        ...(input.debugMode !== undefined ? { debugMode: input.debugMode } : {}),
        ...(input.httpsEnforced !== undefined ? { httpsEnforced: input.httpsEnforced } : {}),
        ...(input.updatesAvailable !== undefined ? { updatesAvailable: input.updatesAvailable } : {}),
        ...(input.plugins !== undefined ? { plugins: input.plugins } : {}),
        ...(input.themes !== undefined ? { themes: input.themes } : {}),
        lastSyncAt: new Date(),
        lastError: null,
      },
      select,
    });
  });
}

export interface UpdateWordpressTelemetryInput {
  status?: WordpressConnectionStatus;
  wpVersion?: string;
  phpVersion?: string;
  serverSoftware?: string;
  debugMode?: boolean;
  httpsEnforced?: boolean;
  updatesAvailable?: Prisma.InputJsonValue;
  plugins?: Prisma.InputJsonValue;
  themes?: Prisma.InputJsonValue;
  lastError?: string | null;
}

export function updateWordpressConnectionTelemetry(
  scope: TenantScope,
  websiteId: string,
  input: UpdateWordpressTelemetryInput,
): Promise<WordpressConnectionRecord> {
  return withTenantTransaction(scope, async (tx) => {
    return tx.wordpressConnection.update({
      where: { websiteId },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.wpVersion !== undefined ? { wpVersion: input.wpVersion } : {}),
        ...(input.phpVersion !== undefined ? { phpVersion: input.phpVersion } : {}),
        ...(input.serverSoftware !== undefined ? { serverSoftware: input.serverSoftware } : {}),
        ...(input.debugMode !== undefined ? { debugMode: input.debugMode } : {}),
        ...(input.httpsEnforced !== undefined ? { httpsEnforced: input.httpsEnforced } : {}),
        ...(input.updatesAvailable !== undefined ? { updatesAvailable: input.updatesAvailable } : {}),
        ...(input.plugins !== undefined ? { plugins: input.plugins } : {}),
        ...(input.themes !== undefined ? { themes: input.themes } : {}),
        lastError: input.lastError,
        lastSyncAt: new Date(),
      },
      select,
    });
  });
}

export function disconnectWordpressConnection(
  scope: TenantScope,
  websiteId: string,
): Promise<void> {
  return withTenantTransaction(scope, async (tx) => {
    await tx.wordpressConnection.deleteMany({
      where: { organizationId: scope.organizationId, websiteId },
    });
  });
}
