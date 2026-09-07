import type { PgBoss } from "pg-boss";
import { getPrisma } from "@/db/client";
import { getJobBoss } from "@/lib/jobs/boss";
import { logger } from "@/lib/logger";
import { createInAppNotification } from "@/services/notifications/repository";
import { withGucContext } from "@/db/tenant";

export const NOTIFICATION_JOB = "notification.deliver" as const;
export type NotificationChannel = "EMAIL" | "IN_APP";
export interface NotificationEvent {
  organizationId: string;
  issueId: string;
  recipientUserId: string;
  /** Resolved from the server-side users table immediately before delivery. */
  recipientEmail?: string;
  title: string;
  body: string;
  channel: NotificationChannel;
}

export interface NotificationProvider {
  deliver(event: NotificationEvent): Promise<void>;
}

export interface EmailNotification {
  to: string;
  subject: string;
  text: string;
  organizationId: string;
  issueId: string;
}

export interface EmailNotificationAdapter {
  send(message: EmailNotification): Promise<void>;
}

/** Creates an email provider without coupling the worker to a vendor SDK. */
export function createEmailNotificationProvider(
  adapter: EmailNotificationAdapter,
): NotificationProvider {
  return {
    async deliver(event) {
      const recipientEmail =
        event.recipientEmail ??
        (event.recipientUserId.includes("@") ? event.recipientUserId : undefined);
      if (recipientEmail === undefined) {
        throw new Error("Cannot deliver email notification without a recipient email address.");
      }
      await adapter.send({
        to: recipientEmail,
        subject: event.title,
        text: event.body,
        organizationId: event.organizationId,
        issueId: event.issueId,
      });
    },
  };
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
    logger.warn("email_notification_not_configured", {
      organizationId: event.organizationId,
      recipientUserId: event.recipientUserId,
      issueId: event.issueId,
    });
  },
};

let configuredEmailProvider: Promise<NotificationProvider> | undefined;

/** Resolves and caches the SMTP adapter once per worker process. */
function getConfiguredEmailProvider(): Promise<NotificationProvider> {
  if (configuredEmailProvider !== undefined) return configuredEmailProvider;
  // Dynamic import keeps SMTP-only code out of client-facing bundles.
  configuredEmailProvider = import("@/services/notifications/smtp").then(
    ({ createSmtpEmailNotificationAdapter }) => {
      const adapter = createSmtpEmailNotificationAdapter();
      return adapter === null
        ? emailNotificationProvider
        : createEmailNotificationProvider(adapter);
    },
  );
  return configuredEmailProvider;
}

/** Routes queued channels to their concrete providers. */
export const productionNotificationProvider: NotificationProvider = {
  async deliver(event) {
    if (event.channel === "IN_APP") {
      await inAppNotificationProvider.deliver(event);
      return;
    }
    await (await getConfiguredEmailProvider()).deliver(event);
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
    const member = await withGucContext(
      { organizationId: job.data.organizationId, userId: job.data.recipientUserId },
      (tx) =>
        tx.organizationMember.findFirst({
          where: {
            organizationId: job.data.organizationId,
            userId: job.data.recipientUserId,
            status: "ACTIVE",
          },
          select: { id: true, user: { select: { email: true } } },
        }),
      prisma,
    );
    if (!member) return;
    const recipientEmail = member.user?.email;
    await provider.deliver(
      recipientEmail === undefined ? job.data : { ...job.data, recipientEmail },
    );
  });
}
