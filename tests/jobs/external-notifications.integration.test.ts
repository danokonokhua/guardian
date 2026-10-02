import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PgBoss } from "pg-boss";
import { expect, it, vi } from "vitest";
vi.mock("@/lib/security/outbound-url", () => ({
  resolveSafeOutboundUrl: async () => ({ address: "93.184.216.34" }),
  requestSafeOutbound: vi.fn(async () => ({ ok: true, status: 204 })),
}));
import { withGucContext } from "@/db/tenant";
import {
  createDestination,
  listDestinations,
  updateDestination,
  deleteDestination,
} from "@/services/notifications/destinations";
import {
  queueDestinationAlerts,
  EXTERNAL_NOTIFICATION_JOB,
} from "@/lib/notification-destinations/queue";
import {
  deliverExternal,
  registerExternalNotificationWorker,
} from "@/lib/notification-destinations/worker";
import type { SendResult } from "@/lib/notification-destinations/transport";

it.skipIf(process.env.DESTINATIONS_LIVE_TEST !== "1")(
  "isolates and encrypts destinations, atomically queues once, retries and cancels safely",
  async () => {
    const db = new PrismaClient();
    const organizationId = randomUUID(),
      userId = randomUUID();
    const schema = "dest_test_" + randomUUID().replaceAll("-", "");
    const boss = new PgBoss({
      connectionString: process.env.DATABASE_URL!,
      schema,
      useListenNotify: false,
    });
    const scope = { organizationId, userId, role: "OWNER" as const };
    const send = vi.fn(async (): Promise<SendResult> => ({
      ok: true,
      retryable: false,
      status: 204,
    }));
    try {
      await db.user.create({ data: { id: userId, email: `dest-${userId}@example.test` } });
      await db.organization.create({
        data: {
          id: organizationId,
          ownerId: userId,
          slug: organizationId,
          name: "Destination fixture",
        },
      });
      await db.organizationMember.create({
        data: { organizationId, userId, role: "OWNER", status: "ACTIVE" },
      });
      const business = await db.business.create({ data: { organizationId, name: "Fixture" } });
      const website = await db.website.create({
        data: {
          organizationId,
          businessId: business.id,
          hostname: "example.test",
          normalizedUrl: "https://example.test",
          verifyStatus: "VERIFIED",
        },
      });
      const issue = await db.issue.create({
        data: {
          organizationId,
          websiteId: website.id,
          ruleId: "monitor.email_spf",
          fingerprint: randomUUID(),
          title: "SPF invalid",
          summary: "Review SPF",
          severity: "MEDIUM",
        },
      });
      const input = {
        name: "Ops webhook",
        channel: "WEBHOOK",
        url: "https://example.com/secret-token",
        signingSecret: "secret".repeat(8),
      };
      await expect(createDestination({ ...scope, role: "MEMBER" }, input)).rejects.toMatchObject({
        status: 403,
      });
      const destination = await createDestination(scope, input);
      expect(destination.enabled).toBe(false);
      const stored = await db.notificationDestination.findUniqueOrThrow({
        where: { id: destination.id },
      });
      expect(stored.credentials).not.toContain("secret-token");
      const listed = JSON.stringify(await listDestinations(scope));
      expect(listed).not.toContain("credentials");
      expect(listed).not.toContain("secret-token");
      expect(listed).not.toContain(input.signingSecret);
      await expect(
        updateDestination({ ...scope, organizationId: randomUUID() }, destination.id, {
          enabled: true,
        }),
      ).rejects.toMatchObject({ status: 404 });
      await updateDestination(scope, destination.id, { enabled: true });
      await boss.start();
      await boss.createQueue(EXTERNAL_NOTIFICATION_JOB);
      const enqueue = (key: string) =>
        withGucContext(
          { organizationId },
          (tx) => queueDestinationAlerts(tx, organizationId, issue.id, key, boss),
          db,
        );
      expect(
        (await Promise.all([enqueue("same"), enqueue("same")])).reduce((a, b) => a + b, 0),
      ).toBe(1);
      const delivery = await db.externalDelivery.findFirstOrThrow({
        where: { destinationId: destination.id },
      });
      await deliverExternal(randomUUID(), delivery.id, boss, send);
      expect(send).not.toHaveBeenCalled();
      await deliverExternal(organizationId, delivery.id, boss, send);
      expect(send).toHaveBeenCalledTimes(1);
      expect(await db.externalDelivery.findUnique({ where: { id: delivery.id } })).toMatchObject({
        status: "DELIVERED",
        attempts: 1,
      });
      await deliverExternal(organizationId, delivery.id, boss, send);
      expect(send).toHaveBeenCalledTimes(1);
      await enqueue("retry");
      const retry = await db.externalDelivery.findUniqueOrThrow({
        where: { destinationId_dedupKey: { destinationId: destination.id, dedupKey: "retry" } },
      });
      send.mockResolvedValueOnce({
        ok: false,
        retryable: true,
        status: 429,
        retryAfter: 75,
        error: "Destination returned HTTP 429.",
      });
      await deliverExternal(organizationId, retry.id, boss, send);
      const pending = await db.externalDelivery.findUniqueOrThrow({ where: { id: retry.id } });
      expect(pending.status).toBe("RETRY");
      expect(pending.leaseUntil!.getTime() - Date.now()).toBeGreaterThan(70000);
      const calls = send.mock.calls.length;
      await deliverExternal(organizationId, retry.id, boss, send);
      expect(send.mock.calls.length).toBe(calls);
      await db.externalDelivery.update({
        where: { id: retry.id },
        data: { leaseUntil: new Date(0) },
      });
      await deliverExternal(organizationId, retry.id, boss, send);
      expect(await db.externalDelivery.findUnique({ where: { id: retry.id } })).toMatchObject({
        status: "DELIVERED",
        attempts: 2,
      });
      await expect(
        withGucContext(
          { organizationId },
          async (tx) => {
            await queueDestinationAlerts(tx, organizationId, issue.id, "rollback", boss);
            throw Error("rollback");
          },
          db,
        ),
      ).rejects.toThrow("rollback");
      expect(
        await db.externalDelivery.count({
          where: { destinationId: destination.id, dedupKey: "rollback" },
        }),
      ).toBe(0);
      await enqueue("pause");
      await updateDestination(scope, destination.id, { enabled: false });
      const cancelled = await db.externalDelivery.findUniqueOrThrow({
        where: { destinationId_dedupKey: { destinationId: destination.id, dedupKey: "pause" } },
      });
      await deliverExternal(organizationId, cancelled.id, boss, send);
      expect(await db.externalDelivery.findUnique({ where: { id: cancelled.id } })).toMatchObject({
        status: "CANCELLED",
      });
      await updateDestination(scope, destination.id, { enabled: true });
      await enqueue("permanent");
      const failed = await db.externalDelivery.findUniqueOrThrow({
        where: { destinationId_dedupKey: { destinationId: destination.id, dedupKey: "permanent" } },
      });
      send.mockResolvedValueOnce({
        ok: false,
        retryable: false,
        status: 403,
        error: "Destination returned HTTP 403.",
      });
      await deliverExternal(organizationId, failed.id, boss, send);
      expect(await db.externalDelivery.findUnique({ where: { id: failed.id } })).toMatchObject({
        status: "FAILED",
      });
      await enqueue("exhausted");
      const exhausted = await db.externalDelivery.findUniqueOrThrow({
        where: { destinationId_dedupKey: { destinationId: destination.id, dedupKey: "exhausted" } },
      });
      await db.externalDelivery.update({ where: { id: exhausted.id }, data: { attempts: 4 } });
      send.mockResolvedValueOnce({
        ok: false,
        retryable: true,
        status: 500,
        error: "Destination returned HTTP 500.",
      });
      await deliverExternal(organizationId, exhausted.id, boss, send);
      expect(await db.externalDelivery.findUnique({ where: { id: exhausted.id } })).toMatchObject({
        status: "FAILED",
        attempts: 5,
      });
      await enqueue("worker");
      const workerDelivery = await db.externalDelivery.findUniqueOrThrow({
        where: { destinationId_dedupKey: { destinationId: destination.id, dedupKey: "worker" } },
      });
      await registerExternalNotificationWorker(boss);
      await vi.waitFor(
        async () =>
          expect(
            await db.externalDelivery.findUnique({ where: { id: workerDelivery.id } }),
          ).toMatchObject({ status: "DELIVERED", attempts: 1 }),
        { timeout: 15000 },
      );
      await db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL ROLE guardian_app");
        await tx.$executeRaw`SELECT set_config('app.org_id', ${randomUUID()}, true)`;
        expect(await tx.notificationDestination.count()).toBe(0);
        expect(await tx.externalDelivery.count()).toBe(0);
        await tx.$executeRaw`SELECT set_config('app.org_id', ${organizationId}, true)`;
        expect(await tx.notificationDestination.count()).toBe(1);
      });
      await deleteDestination(scope, destination.id);
      expect(await db.externalDelivery.count({ where: { organizationId } })).toBe(0);
    } finally {
      await boss.stop({ graceful: true, timeout: 5000 });
      if (!/^dest_test_[a-f0-9]{32}$/.test(schema)) throw Error("Invalid fixture schema");
      await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await db.organization.deleteMany({ where: { id: organizationId } });
      await db.user.deleteMany({ where: { id: userId } });
      await db.$disconnect();
    }
  },
  60000,
);
