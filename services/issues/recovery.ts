import "server-only";

import type { Prisma } from "@prisma/client";
import type { PgBoss } from "pg-boss";
import { enqueueNotification, type NotificationEvent } from "@/lib/notifications";
import { queueDestinationAlerts } from "@/lib/notification-destinations/queue";

export interface IssueRecoveryDetails {
  id: string;
  organizationId: string;
  title: string;
  summary: string;
  severity: string;
  ruleId: string;
  resolvedAt?: Date | null;
  resolvedBy?: string | null;
}

export interface DispatchRecoveryResult {
  externalCount: number;
  internalCount: number;
}

/**
 * Dispatches recovery notifications when an issue resolves (auto-recovery by monitor or manual resolution).
 * Notifies:
 *  1. External destinations (Slack, Discord, Teams, Webhooks) via queueDestinationAlerts.
 *  2. Internal organization members (In-App notification + Email via SMTP/Resend) respecting preferences.
 */
export async function dispatchIssueRecoveryNotifications(
  tx: Prisma.TransactionClient,
  organizationId: string,
  issue: IssueRecoveryDetails,
  options?: {
    boss?: PgBoss;
    enqueue?: (event: NotificationEvent) => Promise<string | null>;
  },
): Promise<DispatchRecoveryResult> {
  const dedupWindow = Math.floor(Date.now() / 60000);
  const dedupKey = `recovery:${issue.id}:${dedupWindow}`;

  let externalCount = 0;
  let internalCount = 0;

  // 1. External channel delivery (Slack, Discord, Teams, Webhooks)
  if ((tx as any).notificationDestination?.findMany && (tx as any).externalDelivery?.createMany) {
    try {
      externalCount = await queueDestinationAlerts(
        tx,
        organizationId,
        issue.id,
        dedupKey,
        options?.boss,
      );
    } catch {
      // External notification dispatch is resilient and does not abort recovery
    }
  }

  // 2. Internal channel delivery (In-app + Email for active members)
  if ((tx as any).organizationMember?.findMany) {
    try {
      const [members, preferences] = await Promise.all([
        tx.organizationMember.findMany({
          where: { organizationId, status: "ACTIVE" },
          select: { userId: true },
        }),
        (tx as any).notificationPreference?.findMany
          ? tx.notificationPreference.findMany({
              where: { organizationId, eventType: "ISSUE" },
              select: { userId: true, channel: true, enabled: true },
            })
          : Promise.resolve([]),
      ]);

      const enqueue =
        options?.enqueue ?? ((event) => enqueueNotification(event, options?.boss));

      for (const member of members) {
        const userPrefs = preferences.filter((p) => p.userId === member.userId);
        const emailPref = userPrefs.find((p) => p.channel === "EMAIL");
        const inAppPref = userPrefs.find((p) => p.channel === "IN_APP");
        const emailEnabled = emailPref ? emailPref.enabled : true;
        const inAppEnabled = inAppPref ? inAppPref.enabled : true;

        if (inAppEnabled && (tx as any).inAppNotification?.create) {
          try {
            await tx.inAppNotification.create({
              data: {
                organizationId,
                userId: member.userId,
                eventType: "ISSUE",
                title: `Resolved: ${issue.title}`,
                body: `Service has recovered. ${issue.title} is now resolved.`,
              },
            });
            internalCount++;
          } catch {
            // Ignore in-app creation error
          }
        }

        if (emailEnabled) {
          try {
            const queued = await enqueue({
              organizationId,
              issueId: issue.id,
              recipientUserId: member.userId,
              title: `Resolved: ${issue.title}`,
              body: `Service has recovered.\n\nIssue: ${issue.title}\nSummary: ${issue.summary}\nStatus: Resolved${issue.resolvedBy ? `\nResolved by: ${issue.resolvedBy}` : ""}`,
              channel: "EMAIL",
            });
            if (queued !== null) internalCount++;
          } catch {
            // Ignore email enqueue error
          }
        }
      }
    } catch {
      // Internal notification dispatch is resilient
    }
  }

  return { externalCount, internalCount };
}
