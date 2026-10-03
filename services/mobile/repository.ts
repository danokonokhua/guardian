import "server-only";

import type { TenantScope } from "@/db/tenant";
import { withTenantTransaction } from "@/db/tenant";
import { getPrisma } from "@/db/client";
import type { PushSubscriptionInput } from "./types";

export interface MobileSubscriptionRecord {
  id: string;
  organizationId: string;
  userId: string;
  endpoint: string;
  p256dhKey: string;
  authKey: string;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSelect = {
  id: true,
  organizationId: true,
  userId: true,
  endpoint: true,
  p256dhKey: true,
  authKey: true,
  userAgent: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function upsertPushSubscriptionRecord(
  scope: TenantScope,
  data: PushSubscriptionInput
): Promise<MobileSubscriptionRecord> {
  return withTenantTransaction(scope, async (tx) =>
    tx.mobilePushSubscription.upsert({
      where: { endpoint: data.endpoint },
      update: {
        organizationId: scope.organizationId,
        userId: scope.userId,
        p256dhKey: data.keys.p256dh,
        authKey: data.keys.auth,
        userAgent: data.userAgent ?? null,
      },
      create: {
        organizationId: scope.organizationId,
        userId: scope.userId,
        endpoint: data.endpoint,
        p256dhKey: data.keys.p256dh,
        authKey: data.keys.auth,
        userAgent: data.userAgent ?? null,
      },
      select: subscriptionSelect,
    })
  );
}

export async function deletePushSubscriptionRecord(
  scope: TenantScope,
  endpoint: string
): Promise<boolean> {
  return withTenantTransaction(scope, async (tx) => {
    const existing = await tx.mobilePushSubscription.findFirst({
      where: { endpoint, organizationId: scope.organizationId },
    });
    if (!existing) return false;

    await tx.mobilePushSubscription.delete({
      where: { endpoint },
    });
    return true;
  });
}

export async function listSubscriptionsForOrg(
  scope: TenantScope
): Promise<MobileSubscriptionRecord[]> {
  return withTenantTransaction(scope, async (tx) =>
    tx.mobilePushSubscription.findMany({
      where: { organizationId: scope.organizationId },
      select: subscriptionSelect,
      orderBy: { createdAt: "desc" },
    })
  );
}

export async function listSubscriptionsForUser(
  scope: TenantScope,
  userId: string
): Promise<MobileSubscriptionRecord[]> {
  return withTenantTransaction(scope, async (tx) =>
    tx.mobilePushSubscription.findMany({
      where: { organizationId: scope.organizationId, userId },
      select: subscriptionSelect,
      orderBy: { createdAt: "desc" },
    })
  );
}

/**
 * Background / cross-worker fetch of active mobile push devices for an organization.
 */
export async function listSubscriptionsGlobalForOrg(
  organizationId: string
): Promise<MobileSubscriptionRecord[]> {
  const prisma = getPrisma();
  return prisma.mobilePushSubscription.findMany({
    where: { organizationId },
    select: subscriptionSelect,
  });
}

