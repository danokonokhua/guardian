import "server-only";

import { randomUUID } from "node:crypto";
import type { TenantScope } from "@/db/tenant";
import { withTenantTransaction } from "@/db/tenant";

export interface WebsiteRecord {
  id: string;
  businessId: string;
  normalizedUrl: string;
  hostname: string;
  label: string | null;
  status: string;
  verifyStatus: string;
  verifyMethod: string | null;
  verifyToken: string | null;
}

const select = {
  id: true,
  businessId: true,
  normalizedUrl: true,
  hostname: true,
  label: true,
  status: true,
  verifyStatus: true,
  verifyMethod: true,
  verifyToken: true,
} as const;

export function listWebsites(scope: TenantScope): Promise<WebsiteRecord[]> {
  return withTenantTransaction(scope, async (tx) =>
    tx.website.findMany({
      where: { organizationId: scope.organizationId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select,
    }),
  );
}

export function createWebsite(
  scope: TenantScope,
  input: {
    normalizedUrl: string;
    hostname: string;
    label?: string;
    businessId?: string;
    businessName?: string;
  },
): Promise<WebsiteRecord> {
  return withTenantTransaction(scope, async (tx) => {
    let businessId = input.businessId;
    if (businessId !== undefined) {
      const business = await tx.business.findFirst({
        where: { id: businessId, organizationId: scope.organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!business) throw new Error("Business not found.");
    } else {
      const business = await tx.business.create({
        data: {
          organizationId: scope.organizationId,
          name: input.businessName?.trim() || input.hostname,
        },
        select: { id: true },
      });
      businessId = business.id;
    }

    return tx.website.create({
      data: {
        organizationId: scope.organizationId,
        businessId,
        addedById: scope.userId,
        normalizedUrl: input.normalizedUrl,
        hostname: input.hostname,
        label: input.label?.trim() || null,
        verifyMethod: "http",
        verifyToken: randomUUID(),
      },
      select,
    });
  });
}

export function findWebsiteForVerification(
  scope: TenantScope,
  websiteId: string,
): Promise<Pick<WebsiteRecord, "id" | "normalizedUrl" | "verifyToken" | "verifyStatus"> | null> {
  return withTenantTransaction(scope, async (tx) =>
    tx.website.findFirst({
      where: { id: websiteId, organizationId: scope.organizationId, deletedAt: null },
      select: { id: true, normalizedUrl: true, verifyToken: true, verifyStatus: true },
    }),
  );
}

export function setWebsiteVerification(
  scope: TenantScope,
  websiteId: string,
  verifyStatus: "VERIFIED" | "FAILED",
): Promise<WebsiteRecord | null> {
  return withTenantTransaction(scope, async (tx) => {
    const existing = await tx.website.findFirst({
      where: { id: websiteId, organizationId: scope.organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) return null;
    return tx.website.update({
      where: { id: websiteId },
      data: { verifyStatus, verificationAttempts: { increment: 1 } },
      select,
    });
  });
}
