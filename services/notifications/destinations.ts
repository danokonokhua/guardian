import "server-only";
import { randomUUID } from "node:crypto";
import { withTenantTransaction, type TenantScope } from "@/db/tenant";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { parseWith } from "@/lib/validation";
import { destinationSchema, destinationUpdateSchema } from "@/lib/notification-destinations/config";
import { validateDestination } from "@/lib/notification-destinations/transport";
import { encryptDestination } from "@/lib/notification-destinations/secrets";
import { EXTERNAL_NOTIFICATION_JOB, sendDeliveryJob } from "@/lib/notification-destinations/queue";
import { startJobBoss } from "@/lib/jobs/boss";
const select = {
  id: true,
  name: true,
  channel: true,
  host: true,
  enabled: true,
  createdAt: true,
  deliveries: {
    orderBy: { createdAt: "desc" as const },
    take: 5,
    select: {
      id: true,
      status: true,
      attempts: true,
      httpStatus: true,
      lastError: true,
      createdAt: true,
      deliveredAt: true,
    },
  },
} as const;
function authorize(scope: TenantScope) {
  if (!["OWNER", "ADMIN"].includes(scope.role)) throw new ForbiddenError();
}
export async function listDestinations(scope: TenantScope) {
  authorize(scope);
  return withTenantTransaction(scope, (tx) =>
    tx.notificationDestination.findMany({
      where: { organizationId: scope.organizationId },
      select,
      orderBy: { createdAt: "asc" },
    }),
  );
}
export async function createDestination(scope: TenantScope, input: unknown) {
  authorize(scope);
  const parsed = parseWith(destinationSchema, input, "destination");
  const url = await validateDestination(parsed.channel, parsed.url);
  const id = randomUUID();
  const credentials = encryptDestination(
    { url: url.href, ...(parsed.signingSecret ? { signingSecret: parsed.signingSecret } : {}) },
    `${scope.organizationId}:${id}`,
  );
  return withTenantTransaction(scope, async (tx) => {
    await tx.$executeRaw`SELECT id FROM organizations WHERE id = ${scope.organizationId} FOR UPDATE`;
    if (
      (await tx.notificationDestination.count({
        where: { organizationId: scope.organizationId },
      })) >= 20
    )
      throw new ConflictError("An organization can configure up to 20 destinations.");
    return tx.notificationDestination.create({
      data: {
        id,
        organizationId: scope.organizationId,
        name: parsed.name,
        channel: parsed.channel,
        host: url.hostname,
        credentials,
      },
      select,
    });
  });
}
export async function updateDestination(scope: TenantScope, id: string, input: unknown) {
  authorize(scope);
  const data = parseWith(destinationUpdateSchema, input, "destination");
  return withTenantTransaction(scope, async (tx) => {
    const updated = await tx.notificationDestination.updateMany({
      where: { id, organizationId: scope.organizationId },
      data,
    });
    if (!updated.count) throw new NotFoundError("Destination");
    return tx.notificationDestination.findFirstOrThrow({
      where: { id, organizationId: scope.organizationId },
      select,
    });
  });
}
export async function deleteDestination(scope: TenantScope, id: string) {
  authorize(scope);
  return withTenantTransaction(scope, async (tx) => {
    const deleted = await tx.notificationDestination.deleteMany({
      where: { id, organizationId: scope.organizationId },
    });
    if (!deleted.count) throw new NotFoundError("Destination");
    return { deleted: true };
  });
}
export async function testDestination(scope: TenantScope, id: string) {
  authorize(scope);
  const boss = await startJobBoss();
  await boss.createQueue(EXTERNAL_NOTIFICATION_JOB);
  return withTenantTransaction(scope, async (tx) => {
    const target = await tx.notificationDestination.findFirst({
      where: { id, organizationId: scope.organizationId },
      select: { id: true },
    });
    if (!target) throw new NotFoundError("Destination");
    const dedupKey = `test:${Math.floor(Date.now() / 60000)}`;
    const inserted = await tx.externalDelivery.createMany({
      data: { organizationId: scope.organizationId, destinationId: id, dedupKey },
      skipDuplicates: true,
    });
    if (!inserted.count)
      throw new ConflictError("A test was already requested this minute. Refresh delivery status.");
    const delivery = await tx.externalDelivery.findUniqueOrThrow({
      where: { destinationId_dedupKey: { destinationId: id, dedupKey } },
      select: { id: true },
    });
    await sendDeliveryJob(tx, boss, scope.organizationId, delivery.id);
    return { deliveryId: delivery.id, status: "PENDING" };
  });
}
