import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PgBoss } from "pg-boss";
import { expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ org: "", user: "", address: "203.0.113.1" }));
vi.mock("@/lib/dns/collector", () => ({
  collectDnsSnapshot: async () => ({
    A: { state: "OK", records: [fixture.address] },
    AAAA: { state: "OK", records: [] },
    MX: { state: "OK", records: [] },
    NS: { state: "OK", records: [] },
    TXT: { state: "OK", records: [] },
  }),
}));
vi.mock("@/lib/auth/context", () => ({
  requirePermission: async () => ({
    organizationId: fixture.org,
    user: { userId: fixture.user },
    membership: { role: "OWNER" },
  }),
}));
import { registerMonitorCheckWorker } from "@/lib/jobs/monitor-check";
import {
  enqueueNotification,
  productionNotificationProvider,
  registerNotificationWorker,
} from "@/lib/notifications";
import { enqueueSlaEscalations } from "@/services/issues/escalation";
import { setPreference } from "@/services/notifications/repository";
import { POST } from "@/app/api/v1/organizations/[organizationId]/monitors/[monitorId]/dns-baseline/route";
it.skipIf(process.env.DNS_LIVE_TEST !== "1")(
  "persists baseline, detects change, accepts and recovers using real PostgreSQL",
  async () => {
    const db = new PrismaClient();
    fixture.org = randomUUID();
    fixture.user = randomUUID();
    const website = randomUUID(),
      business = randomUUID(),
      monitor = randomUUID();
    const queueSchema = "dns_test_" + randomUUID().replaceAll("-", "");
    const boss = new PgBoss({
      connectionString: process.env.DATABASE_URL!,
      schema: queueSchema,
      useListenNotify: false,
    });
    const run = async (jobs: Array<{ data: Record<string, string> }>) => {
      const id = await boss.send("monitor.check", jobs[0]!.data);
      await vi.waitFor(
        async () => {
          expect(await boss.getJobById("monitor.check", id!)).toMatchObject({ state: "completed" });
        },
        { timeout: 15000, interval: 100 },
      );
    };
    try {
      await db.user.create({
        data: { id: fixture.user, email: `dns-${fixture.user}@example.test` },
      });
      await db.organization.create({
        data: {
          id: fixture.org,
          name: "DNS integration fixture",
          slug: `dns-${fixture.org}`,
          ownerId: fixture.user,
        },
      });
      await db.organizationMember.create({
        data: {
          organizationId: fixture.org,
          userId: fixture.user,
          role: "OWNER",
          status: "ACTIVE",
        },
      });
      await db.business.create({
        data: { id: business, organizationId: fixture.org, name: "DNS fixture" },
      });
      await db.website.create({
        data: {
          id: website,
          organizationId: fixture.org,
          businessId: business,
          hostname: `${fixture.org}.example.test`,
          normalizedUrl: `https://${fixture.org}.example.test`,
          verifyStatus: "VERIFIED",
        },
      });
      await db.monitor.create({
        data: {
          id: monitor,
          organizationId: fixture.org,
          websiteId: website,
          type: "DNS",
          frequencyMinutes: 5,
        },
      });
      await boss.start();
      await registerMonitorCheckWorker(boss);
      await registerNotificationWorker(boss, productionNotificationProvider);
      const scope = { organizationId: fixture.org, userId: fixture.user, role: "OWNER" as const };
      await setPreference(scope, fixture.user, "ISSUE", "EMAIL", false);
      const job = [
        {
          data: {
            organizationId: fixture.org,
            websiteId: website,
            monitorId: monitor,
            type: "DNS",
          },
        },
      ];
      await run(job);
      expect(await db.issue.count({ where: { organizationId: fixture.org } })).toBe(0);
      fixture.address = "203.0.113.2";
      await run(job);
      expect(await db.issue.findFirst({ where: { organizationId: fixture.org } })).toMatchObject({
        ruleId: "monitor.dns",
        status: "OPEN",
      });
      const saved = await db.monitor.findUniqueOrThrow({ where: { id: monitor } });
      const config = saved.config as { observedAt: string; baseline: { A: string[] } };
      expect(config.baseline.A).toEqual(["203.0.113.1"]);
      await db.issue.updateMany({
        where: { organizationId: fixture.org },
        data: { firstSeenAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      });
      const enqueue = (event: Parameters<typeof enqueueNotification>[0]) =>
        enqueueNotification(event, boss);
      expect((await enqueueSlaEscalations(scope, enqueue)).notificationsQueued).toBe(1);
      expect((await enqueueSlaEscalations(scope, enqueue)).notificationsQueued).toBe(0);
      await vi.waitFor(
        async () => {
          const notifications = await db.inAppNotification.findMany({
            where: { organizationId: fixture.org },
          });
          expect(notifications).toHaveLength(1);
          expect(notifications[0]?.title).toContain("SLA breach:");
        },
        { timeout: 15000, interval: 100 },
      );
      const response = await POST(
        new Request("http://localhost/dns-baseline", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ observedAt: config.observedAt }),
        }),
        { params: Promise.resolve({ organizationId: fixture.org, monitorId: monitor }) },
      );
      expect(response.status).toBe(200);
      await run(job);
      expect(await db.issue.findFirst({ where: { organizationId: fixture.org } })).toMatchObject({
        status: "RESOLVED",
      });
      expect(await db.monitoringResult.count({ where: { monitorId: monitor } })).toBe(4);
      expect((await enqueueSlaEscalations(scope, enqueue)).notificationsQueued).toBe(0);
    } finally {
      await boss.stop({ graceful: true, timeout: 5000 });
      if (!/^dns_test_[a-f0-9]{32}$/.test(queueSchema)) throw new Error("Invalid test schema");
      await db.$executeRawUnsafe(`DROP SCHEMA "${queueSchema}" CASCADE`);
      await db.organization.deleteMany({ where: { id: fixture.org } });
      await db.user.deleteMany({ where: { id: fixture.user } });
      await db.$disconnect();
    }
  },
  60000,
);
