import "server-only";

import type { GoogleProvider, GoogleIntegrationStatus, Prisma } from "@prisma/client";
import type { TenantScope } from "@/db/tenant";
import { withTenantTransaction } from "@/db/tenant";

export interface GoogleIntegrationRecord {
  id: string;
  organizationId: string;
  websiteId: string | null;
  provider: GoogleProvider;
  status: GoogleIntegrationStatus;
  accountEmail: string | null;
  propertyId: string | null;
  propertyName: string | null;
  encryptedCredentials: string;
  lastSyncAt: Date | null;
  lastError: string | null;
  syncSummary: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const select = {
  id: true,
  organizationId: true,
  websiteId: true,
  provider: true,
  status: true,
  accountEmail: true,
  propertyId: true,
  propertyName: true,
  encryptedCredentials: true,
  lastSyncAt: true,
  lastError: true,
  syncSummary: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function listGoogleIntegrations(scope: TenantScope): Promise<GoogleIntegrationRecord[]> {
  return withTenantTransaction(scope, async (tx) =>
    tx.googleIntegration.findMany({
      where: { organizationId: scope.organizationId },
      select,
      orderBy: { createdAt: "asc" },
    }),
  );
}

export function findGoogleIntegration(
  scope: TenantScope,
  id: string,
): Promise<GoogleIntegrationRecord | null> {
  return withTenantTransaction(scope, async (tx) =>
    tx.googleIntegration.findFirst({
      where: { id, organizationId: scope.organizationId },
      select,
    }),
  );
}

export function findGoogleIntegrationByProvider(
  scope: TenantScope,
  provider: GoogleProvider,
  propertyId?: string,
): Promise<GoogleIntegrationRecord | null> {
  return withTenantTransaction(scope, async (tx) =>
    tx.googleIntegration.findFirst({
      where: {
        organizationId: scope.organizationId,
        provider,
        ...(propertyId ? { propertyId } : {}),
      },
      select,
    }),
  );
}

export interface UpsertGoogleIntegrationInput {
  websiteId?: string | null;
  provider: GoogleProvider;
  accountEmail?: string | null;
  propertyId?: string | null;
  propertyName?: string | null;
  encryptedCredentials: string;
  status?: GoogleIntegrationStatus;
  syncSummary?: Prisma.InputJsonValue;
}

export function upsertGoogleIntegration(
  scope: TenantScope,
  input: UpsertGoogleIntegrationInput,
): Promise<GoogleIntegrationRecord> {
  return withTenantTransaction(scope, async (tx) => {
    const existing = await tx.googleIntegration.findFirst({
      where: {
        organizationId: scope.organizationId,
        provider: input.provider,
        propertyId: input.propertyId ?? null,
      },
    });

    if (existing) {
      return tx.googleIntegration.update({
        where: { id: existing.id },
        data: {
          websiteId: input.websiteId ?? existing.websiteId,
          accountEmail: input.accountEmail ?? existing.accountEmail,
          propertyName: input.propertyName ?? existing.propertyName,
          encryptedCredentials: input.encryptedCredentials,
          status: input.status ?? "CONNECTED",
          lastError: null,
          syncSummary: (input.syncSummary as any) ?? existing.syncSummary,
          updatedAt: new Date(),
        },
        select,
      });
    }

    return tx.googleIntegration.create({
      data: {
        organizationId: scope.organizationId,
        websiteId: input.websiteId ?? null,
        provider: input.provider,
        status: input.status ?? "CONNECTED",
        accountEmail: input.accountEmail ?? null,
        propertyId: input.propertyId ?? null,
        propertyName: input.propertyName ?? null,
        encryptedCredentials: input.encryptedCredentials,
        syncSummary: (input.syncSummary as any) ?? undefined,
      },
      select,
    });
  });
}

export function updateGoogleIntegrationStatus(
  scope: TenantScope,
  id: string,
  status: GoogleIntegrationStatus,
  lastError?: string | null,
): Promise<GoogleIntegrationRecord> {
  return withTenantTransaction(scope, async (tx) =>
    tx.googleIntegration.update({
      where: { id, organizationId: scope.organizationId },
      data: {
        status,
        lastError: lastError ?? null,
        updatedAt: new Date(),
      },
      select,
    }),
  );
}

export function updateGoogleIntegrationSummary(
  scope: TenantScope,
  id: string,
  syncSummary: Prisma.InputJsonValue,
): Promise<GoogleIntegrationRecord> {
  return withTenantTransaction(scope, async (tx) =>
    tx.googleIntegration.update({
      where: { id, organizationId: scope.organizationId },
      data: {
        syncSummary,
        lastSyncAt: new Date(),
        lastError: null,
        status: "CONNECTED",
        updatedAt: new Date(),
      },
      select,
    }),
  );
}

export function disconnectGoogleIntegration(scope: TenantScope, id: string): Promise<void> {
  return withTenantTransaction(scope, async (tx) => {
    await tx.googleIntegration.deleteMany({
      where: { id, organizationId: scope.organizationId },
    });
  });
}
