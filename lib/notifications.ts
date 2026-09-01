import type { PgBoss } from "pg-boss";
import { getPrisma } from "@/db/client";
import { getJobBoss } from "@/lib/jobs/boss";
import { logger } from "@/lib/logger";
import { createInAppNotification } from "@/services/notifications/repository";

export const NOTIFICATION_JOB = "notification.deliver" as const;
export type NotificationChannel = "EMAIL" | "IN_APP";
export interface NotificationEvent {
  organizationId: string;
  issueId: string;
  recipientUserId: string;
  title: string;
  body: string;
  channel: NotificationChannel;
}

export interface NotificationProvider {
  deliver(event: NotificationEvent): Promise<void>;
}

export const inAppNotificationProvider: NotificationProvider = {
  async deliver(event) {
    await createInAppNotification(
      { organizationId: event.organizationId, userId: event.recipientUserId, role: "OWNER" },
      { userId: event.recipientUserId, eventType: "ISSUE", title: event.title, body: event.body },
    );
  },
};

export const emailNotificationProvider: NotificationProvider = {
  async deliver(event) {
    logger.info("email_notification_queued", {
      organizationId: event.organizationId,
      recipientUserId: event.recipientUserId,
      issueId: event.issueId,
    });
  },
};

/** Local provider; production adapters can implement the same interface. */
export const loggingNotificationProvider: NotificationProvider = {
  async deliver(event) {
    logger.info("notification_delivered", {
      organizationId: event.organizationId,
      issueId: event.issueId,
      channel: event.channel,
    });
  },
};

export async function enqueueNotification(
  event: NotificationEvent,
  boss: PgBoss = getJobBoss(),
): Promise<string | null> {
  await boss.createQueue(NOTIFICATION_JOB, {
    retryLimit: 3,
    retryDelay: 10,
    retryBackoff: true,
    expireInSeconds: 300,
  });
  return boss.send(NOTIFICATION_JOB, event, {
    retryLimit: 3,
    retryDelay: 10,
    retryBackoff: true,
    expireInSeconds: 300,
    singletonKey: `${event.issueId}:${event.recipientUserId}:${event.channel}`,
    singletonSeconds: 300,
  });
}

export async function registerNotificationWorker(
  boss: PgBoss = getJobBoss(),
  provider: NotificationProvider = loggingNotificationProvider,
): Promise<void> {
  await boss.createQueue(NOTIFICATION_JOB);
  await boss.work<NotificationEvent>(NOTIFICATION_JOB, async ([job]) => {
    if (!job) return;
    const prisma = getPrisma();
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId: job.data.organizationId,
        userId: job.data.recipientUserId,
        status: "ACTIVE",
      },
    });
    if (!member) return;
    await provider.deliver(job.data);
  });
}
