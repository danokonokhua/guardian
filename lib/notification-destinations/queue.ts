import "server-only";
import type { Prisma } from "@prisma/client";
import type { PgBoss } from "pg-boss";
import { startJobBoss } from "@/lib/jobs/boss";
export const EXTERNAL_NOTIFICATION_JOB = "notification.external";
export async function sendDeliveryJob(
  tx: Prisma.TransactionClient,
  boss: PgBoss,
  organizationId: string,
  deliveryId: string,
  delaySeconds = 0,
) {
  const id = await boss.send(
    EXTERNAL_NOTIFICATION_JOB,
    { organizationId, deliveryId },
    {
      retryLimit: 4,
      retryDelay: 30,
      retryBackoff: true,
      expireInSeconds: 120,
      startAfter: delaySeconds,
      db: {
        executeSql: async (sql, values = []) => ({
          rows: await tx.$queryRawUnsafe<unknown[]>(sql, ...values),
        }),
      },
    },
  );
  if (!id) throw Error("External delivery could not be queued.");
}
export async function queueDestinationAlerts(
  tx: Prisma.TransactionClient,
  organizationId: string,
  issueId: string,
  dedupKey: string,
  boss?: PgBoss,
) {
  const destinations = await tx.notificationDestination.findMany({
    where: { organizationId, enabled: true },
    select: { id: true },
    take: 20,
  });
  let count = 0;
  for (const destination of destinations) {
    const created = await tx.externalDelivery.createMany({
      data: { organizationId, destinationId: destination.id, issueId, dedupKey },
      skipDuplicates: true,
    });
    if (!created.count) continue;
    const delivery = await tx.externalDelivery.findUniqueOrThrow({
      where: { destinationId_dedupKey: { destinationId: destination.id, dedupKey } },
      select: { id: true },
    });
    const activeBoss = boss ?? (await startJobBoss());
    await activeBoss.createQueue(EXTERNAL_NOTIFICATION_JOB);
    await sendDeliveryJob(tx, activeBoss, organizationId, delivery.id);
    count++;
  }
  return count;
}
