import "server-only";

import type { TenantScope } from "@/db/tenant";
import { withTenantTransaction } from "@/db/tenant";
import { getPrisma } from "@/db/client";

export const apiKeyPublicSelect = {
  id: true,
  organizationId: true,
  name: true,
  keyPrefix: true,
  scopes: true,
  rateLimitPerMinute: true,
  lastUsedAt: true,
  expiresAt: true,
  revokedAt: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type ApiKeyPublicRecord = {
  id: string;
  organizationId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  rateLimitPerMinute: number;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ApiKeyFullRecord = ApiKeyPublicRecord & {
  keyHash: string;
};

export async function listApiKeysByOrg(
  scope: TenantScope
): Promise<ApiKeyPublicRecord[]> {
  return withTenantTransaction(scope, async (tx) =>
    tx.apiKey.findMany({
      where: { organizationId: scope.organizationId },
      select: apiKeyPublicSelect,
      orderBy: { createdAt: "desc" },
    })
  );
}

export async function findApiKeyById(
  scope: TenantScope,
  id: string
): Promise<ApiKeyPublicRecord | null> {
  return withTenantTransaction(scope, async (tx) =>
    tx.apiKey.findFirst({
      where: { id, organizationId: scope.organizationId },
      select: apiKeyPublicSelect,
    })
  );
}

export async function createApiKeyRecord(
  scope: TenantScope,
  data: {
    name: string;
    keyPrefix: string;
    keyHash: string;
    scopes: string[];
    rateLimitPerMinute: number;
    expiresAt?: Date | null;
    createdById?: string | null;
  }
): Promise<ApiKeyPublicRecord> {
  return withTenantTransaction(scope, async (tx) =>
    tx.apiKey.create({
      data: {
        organizationId: scope.organizationId,
        name: data.name,
        keyPrefix: data.keyPrefix,
        keyHash: data.keyHash,
        scopes: data.scopes,
        rateLimitPerMinute: data.rateLimitPerMinute,
        expiresAt: data.expiresAt ?? null,
        createdById: data.createdById ?? null,
      },
      select: apiKeyPublicSelect,
    })
  );
}

export async function revokeApiKeyRecord(
  scope: TenantScope,
  id: string
): Promise<ApiKeyPublicRecord | null> {
  return withTenantTransaction(scope, async (tx) => {
    const existing = await tx.apiKey.findFirst({
      where: { id, organizationId: scope.organizationId },
    });
    if (!existing) return null;

    return tx.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
      select: apiKeyPublicSelect,
    });
  });
}

/**
 * Global token lookup by SHA-256 hash across tenants.
 * Used exclusively for authenticating inbound Bearer / X-API-Key requests before tenant context is set.
 */
export async function findApiKeyByHashGlobal(
  keyHash: string
): Promise<ApiKeyFullRecord | null> {
  const prisma = getPrisma();
  return prisma.apiKey.findFirst({
    where: { keyHash },
  });
}

/**
 * Updates lastUsedAt timestamp asynchronously.
 */
export async function updateApiKeyLastUsedGlobal(id: string): Promise<void> {
  try {
    const prisma = getPrisma();
    await prisma.apiKey.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  } catch {
    // Non-fatal if lastUsedAt update fails
  }
}
