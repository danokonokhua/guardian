import { withTenantTransaction, type TenantScope } from "@/db/tenant";
import { getPrisma } from "@/db/client";

export async function isChannelEnabled(
  scope: TenantScope,
  userId: string,
  eventType: string,
  channel: string,
): Promise<boolean> {
  const row = await withTenantTransaction(
    scope,
    (tx) =>
      tx.notificationPreference.findUnique({
        where: {
          organizationId_userId_eventType_channel: {
            organizationId: scope.organizationId,
            userId,
            eventType,
            channel,
          },
        },
      }),
    getPrisma(),
  );
  return row?.enabled ?? true;
}

export async function setPreference(
  scope: TenantScope,
  userId: string,
  eventType: string,
  channel: string,
  enabled: boolean,
) {
  return withTenantTransaction(
    scope,
    (tx) =>
      tx.notificationPreference.upsert({
        where: {
          organizationId_userId_eventType_channel: {
            organizationId: scope.organizationId,
            userId,
            eventType,
            channel,
          },
        },
        create: { organizationId: scope.organizationId, userId, eventType, channel, enabled },
        update: { enabled },
      }),
    getPrisma(),
  );
}

export async function createInAppNotification(
  scope: TenantScope,
  data: { userId: string; eventType: string; title: string; body: string },
) {
  return withTenantTransaction(
    scope,
    (tx) =>
      tx.inAppNotification.create({ data: { organizationId: scope.organizationId, ...data } }),
    getPrisma(),
  );
}

export async function listInAppNotifications(scope: TenantScope, userId: string) {
  return withTenantTransaction(
    scope,
    (tx) =>
      tx.inAppNotification.findMany({
        where: { organizationId: scope.organizationId, userId },
        orderBy: { createdAt: "desc" },
      }),
    getPrisma(),
  );
}

export async function markInAppNotificationRead(
  scope: TenantScope,
  userId: string,
  notificationId: string,
) {
  return withTenantTransaction(
    scope,
    (tx) =>
      tx.inAppNotification.updateMany({
        where: { id: notificationId, organizationId: scope.organizationId, userId, readAt: null },
        data: { readAt: new Date() },
      }),
    getPrisma(),
  );
}
