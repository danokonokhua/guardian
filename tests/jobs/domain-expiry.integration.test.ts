import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PgBoss } from "pg-boss";
import { expect, it, vi } from "vitest";
vi.mock("@/lib/domain-expiry/collector", () => ({
  collectDomainExpiry: async () => ({
    state: "UNKNOWN",
    domain: "example.com",
    reason: "worker_fixture",
  }),
}));
import { registerMonitorCheckWorker } from "@/lib/jobs/monitor-check";
import { persistDomainExpiry } from "@/lib/jobs/domain-expiry-check";
import { withGucContext } from "@/db/tenant";
import { NOTIFICATION_JOB } from "@/lib/notifications";

it.skipIf(process.env.EXPIRY_LIVE_TEST !== "1")(
  "persists expiry cycles, deduplicates sibling checks and atomically queues alerts",
  async () => {
    const db = new PrismaClient();
    const userId = randomUUID(),
      organizationId = randomUUID(),
      websiteId = randomUUID();
    const queueSchema = "expiry_test_" + randomUUID().replaceAll("-", "");
    const boss = new PgBoss({
      connectionString: process.env.DATABASE_URL!,
      schema: queueSchema,
      useListenNotify: false,
    });
    const expiry = "2027-01-01T00:00:00.000Z";
    const known = {
      state: "KNOWN" as const,
      domain: "example.com",
      expiresAt: expiry,
      source: "https://rdap.example.test/domain/example.com",
    };
    const at = (days: number) => new Date(Date.parse(expiry) - days * 86400000);
    try {
      await db.user.create({ data: { id: userId, email: `expiry-${userId}@example.test` } });
      await db.organization.create({
        data: { id: organizationId, name: "Expiry fixture", slug: organizationId, ownerId: userId },
      });
      await db.organizationMember.create({
        data: { organizationId, userId, role: "OWNER", status: "ACTIVE" },
      });
      const business = await db.business.create({
        data: { organizationId, name: "Expiry fixture" },
      });
      await db.website.create({
        data: {
          id: websiteId,
          organizationId,
          businessId: business.id,
          hostname: "www.example.com",
          normalizedUrl: "https://www.example.com",
          verifyStatus: "VERIFIED",
        },
      });
      await db.notificationPreference.create({
        data: { organizationId, userId, eventType: "ISSUE", channel: "EMAIL", enabled: false },
      });
      const monitor = await db.monitor.create({
        data: { organizationId, websiteId, type: "DOMAIN_EXPIRY", frequencyMinutes: 1440 },
      });
      const siblingWebsite = await db.website.create({
        data: {
          organizationId,
          businessId: business.id,
          hostname: "shop.example.com",
          normalizedUrl: "https://shop.example.com",
          verifyStatus: "VERIFIED",
        },
      });
      const sibling = await db.monitor.create({
        data: {
          organizationId,
          websiteId: siblingWebsite.id,
          type: "DOMAIN_EXPIRY",
          frequencyMinutes: 1440,
          config: { thresholds: [90] },
        },
      });
      await boss.start();
      await boss.createQueue(NOTIFICATION_JOB);
      const run = (days: number, monitorId = monitor.id, observation = known) =>
        withGucContext(
          { organizationId },
          (tx) => persistDomainExpiry(tx, boss, monitorId, observation, at(days)),
          db,
        );
      const claims = () => db.domainExpiryAlert.count({ where: { organizationId } });
      await run(120);
      expect(await claims()).toBe(0);
      await Promise.all([run(90), run(90, sibling.id)]);
      expect(await claims()).toBe(1);
      await run(30);
      await run(7);
      expect(await claims()).toBe(3);
      await run(7, sibling.id);
      expect(
        await db.issue.count({ where: { organizationId, status: "OPEN", severity: "HIGH" } }),
      ).toBe(1);
      await withGucContext(
        { organizationId },
        (tx) =>
          persistDomainExpiry(
            tx,
            boss,
            monitor.id,
            { state: "UNKNOWN", domain: "example.com", reason: "rdap_unavailable" },
            at(6),
          ),
        db,
      );
      expect(
        await db.issue.count({ where: { organizationId, status: "OPEN", severity: "HIGH" } }),
      ).toBe(1);
      expect(
        (await db.monitor.findUniqueOrThrow({ where: { id: monitor.id } })).config,
      ).toMatchObject({ expiry: { state: "UNKNOWN" }, lastSuccessful: { expiresAt: expiry } });
      // A failed transaction must not consume the threshold or leave a queued job.
      await expect(
        withGucContext(
          { organizationId },
          async (tx) => {
            await persistDomainExpiry(tx, boss, monitor.id, known, at(0));
            throw Error("rollback fixture");
          },
          db,
        ),
      ).rejects.toThrow("rollback fixture");
      expect(await claims()).toBe(3);
      await run(0);
      expect(await claims()).toBe(4);
      const jobs = await boss.fetch(NOTIFICATION_JOB, { batchSize: 20 });
      expect(jobs).toHaveLength(4);
      expect(jobs.every((job) => (job.data as { channel: string }).channel === "IN_APP")).toBe(
        true,
      );
      for (const job of jobs) await boss.complete(NOTIFICATION_JOB, job.id);
      await run(0, monitor.id, { ...known, expiresAt: "2028-01-01T00:00:00.000Z" });
      expect(await db.issue.count({ where: { organizationId, status: "OPEN" } })).toBe(0);
      await withGucContext(
        { organizationId },
        (tx) =>
          persistDomainExpiry(
            tx,
            boss,
            monitor.id,
            { ...known, expiresAt: "2028-01-01T00:00:00.000Z" },
            new Date("2027-12-28T00:00:00Z"),
          ),
        db,
      );
      expect(await claims()).toBe(5);
      await registerMonitorCheckWorker(boss);
      const jobId = await boss.send("monitor.check", {
        organizationId,
        websiteId,
        monitorId: monitor.id,
        type: "UPTIME",
      });
      await vi.waitFor(
        async () =>
          expect(await boss.getJobById("monitor.check", jobId!)).toMatchObject({
            state: "completed",
          }),
        { timeout: 15000 },
      );
      expect(
        (await db.monitor.findUniqueOrThrow({ where: { id: monitor.id } })).config,
      ).toMatchObject({ expiry: { reason: "worker_fixture" } });
      // FORCE RLS must isolate the ledger even when table privileges exist.
      await db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL ROLE guardian_app");
        await tx.$executeRaw`SELECT set_config('app.org_id', ${randomUUID()}, true)`;
        expect(await tx.domainExpiryAlert.count()).toBe(0);
        await tx.$executeRaw`SELECT set_config('app.org_id', ${organizationId}, true)`;
        expect(await tx.domainExpiryAlert.count()).toBe(5);
      });
    } finally {
      await boss.stop({ graceful: true, timeout: 5000 });
      if (!/^expiry_test_[a-f0-9]{32}$/.test(queueSchema)) throw Error("Invalid test schema");
      await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${queueSchema}" CASCADE`);
      await db.organization.deleteMany({ where: { id: organizationId } });
      await db.user.deleteMany({ where: { id: userId } });
      await db.$disconnect();
    }
  },
  60000,
);
