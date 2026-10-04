import "server-only";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { PgBoss } from "pg-boss";
import { withGucContext } from "@/db/tenant";
import { decryptDestination } from "./secrets";
import { sendDestination, type ExternalMessage, type SendResult } from "./transport";
import { DESTINATION_CHANNELS, type DestinationChannel } from "./config";
import { EXTERNAL_NOTIFICATION_JOB, sendDeliveryJob } from "./queue";

export async function deliverExternal(
  organizationId: string,
  deliveryId: string,
  boss: PgBoss,
  send = sendDestination,
) {
  const leaseId = randomUUID();
  const claimed = await withGucContext({ organizationId }, async (tx) => {
    const count = await tx.externalDelivery.updateMany({
      where: {
        id: deliveryId,
        organizationId,
        status: { in: ["PENDING", "RETRY", "SENDING"] },
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
      },
      data: {
        leaseId,
        leaseUntil: new Date(Date.now() + 60000),
        status: "SENDING",
        attempts: { increment: 1 },
      },
    });
    if (!count.count) {
      const current = await tx.externalDelivery.findFirst({
        where: { id: deliveryId, organizationId },
        select: { status: true },
      });
      if (current?.status === "SENDING") throw Error("Delivery is leased; retry later.");
      return null;
    }
    const delivery = await tx.externalDelivery.findUniqueOrThrow({
      where: { id: deliveryId },
      include: { destination: true },
    });
    const issue = delivery.issueId
      ? await tx.issue.findFirst({ where: { id: delivery.issueId, organizationId } })
      : null;
    const statusMessage = z
      .object({
        pageId: z.string().uuid(),
        version: z.number().int(),
        title: z.string().max(120),
        body: z.string().max(1600),
      })
      .safeParse(delivery.statusMessage);
    const statusPage = statusMessage.success
      ? await tx.statusPage.findFirst({
          where: {
            id: statusMessage.data.pageId,
            organizationId,
            published: true,
            version: statusMessage.data.version,
          },
        })
      : null;
    const isRecovery = delivery.dedupKey.startsWith("recovery:");
    if (
      (delivery.statusMessage !== null &&
        (!statusMessage.success || !statusPage || !delivery.destination.enabled)) ||
      (delivery.issueId &&
        (!delivery.destination.enabled ||
          !issue ||
          (!isRecovery && ["RESOLVED", "IGNORED"].includes(issue.status)))) ||
      !DESTINATION_CHANNELS.includes(delivery.destination.channel as DestinationChannel)
    ) {
      await tx.externalDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "CANCELLED",
          leaseUntil: null,
          leaseId: null,
          lastError: "Destination disabled or incident no longer active.",
        },
      });
      return null;
    }
    if (delivery.attempts > 5) {
      await tx.externalDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "FAILED",
          leaseUntil: null,
          leaseId: null,
          lastError: "Delivery attempt limit reached.",
        },
      });
      return null;
    }
    return { delivery, issue, statusMessage: statusMessage.success ? statusMessage.data : null };
  });
  if (!claimed) return;
  const { delivery, issue, statusMessage } = claimed;
  const isRecovery = delivery.dedupKey.startsWith("recovery:");
  const message: ExternalMessage = {
    deliveryId,
    organizationId,
    issueId: delivery.issueId,
    title:
      statusMessage?.title ??
      (isRecovery && issue?.title
        ? `Resolved: ${issue.title}`
        : (issue?.title ?? "Guardian test notification")),
    body:
      statusMessage?.body ??
      (isRecovery
        ? `Service has recovered. ${issue?.summary ?? ""}`.trim()
        : (issue?.summary ?? "Your Guardian notification destination is reachable.")),
    severity: isRecovery ? "INFO" : (issue?.severity ?? "INFO"),
    test: !delivery.issueId && !statusMessage,
    ...(statusMessage ? { event: "guardian.status" as const } : {}),
    createdAt: delivery.createdAt.toISOString(),
  };
  let result: SendResult;
  try {
    const credentials = decryptDestination(
      delivery.destination.credentials,
      `${organizationId}:${delivery.destinationId}`,
    );
    result = await send(delivery.destination.channel as DestinationChannel, credentials, message);
  } catch {
    result = {
      ok: false,
      retryable: false,
      error: "Notification credentials are unavailable. Check the server encryption key.",
    };
  }
  await withGucContext({ organizationId }, async (tx) => {
    const retry = !result.ok && result.retryable && delivery.attempts < 5;
    const delay = Math.max(result.retryAfter ?? 0, 30 * 2 ** (delivery.attempts - 1));
    const changed = await tx.externalDelivery.updateMany({
      where: { id: deliveryId, organizationId, leaseId },
      data: {
        status: result.ok ? "DELIVERED" : retry ? "RETRY" : "FAILED",
        lastError: result.error ?? null,
        httpStatus: result.status ?? null,
        deliveredAt: result.ok ? new Date() : null,
        leaseId: null,
        leaseUntil: retry ? new Date(Date.now() + delay * 1000) : null,
      },
    });
    if (changed.count && retry) await sendDeliveryJob(tx, boss, organizationId, deliveryId, delay);
  });
}
export async function registerExternalNotificationWorker(boss: PgBoss) {
  await boss.createQueue(EXTERNAL_NOTIFICATION_JOB);
  await boss.work<{ organizationId: string; deliveryId: string }>(
    EXTERNAL_NOTIFICATION_JOB,
    async ([job]) => {
      if (job) await deliverExternal(job.data.organizationId, job.data.deliveryId, boss);
    },
  );
}
