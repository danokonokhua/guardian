import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PgBoss } from "pg-boss";
import { expect, it, vi } from "vitest";
import { withGucContext } from "@/db/tenant";
import { persistEmailHealth } from "@/lib/jobs/email-health-check";
import {
  evidence,
  EMAIL_PROTOCOLS,
  type EmailHealthSnapshot,
  type PolicyState,
} from "@/lib/email-health/types";
import { enqueueSlaEscalations } from "@/services/issues/escalation";
import { setPreference } from "@/services/notifications/repository";
const fixture = vi.hoisted(() => ({ snapshot: {} as EmailHealthSnapshot }));
vi.mock("@/lib/email-health/collector", () => ({
  collectEmailHealth: async () => fixture.snapshot,
}));
import { registerMonitorCheckWorker } from "@/lib/jobs/monitor-check";

it.skipIf(process.env.EMAIL_HEALTH_LIVE_TEST !== "1")(
  "persists independent policy states, recovers only known healthy checks, and routes SLA alerts",
  async () => {
    const db = new PrismaClient();
    const organizationId = randomUUID(),
      userId = randomUUID();
    const schema = "email_test_" + randomUUID().replaceAll("-", "");
    const boss = new PgBoss({
      connectionString: process.env.DATABASE_URL!,
      schema,
      useListenNotify: false,
    });
    let timestamp = Date.now() - 10000;
    const observation = (state: PolicyState): EmailHealthSnapshot => ({
      domain: "example.com",
      checkedAt: new Date((timestamp += 1000)).toISOString(),
      checks: Object.fromEntries(
        EMAIL_PROTOCOLS.map((p) => [
          p,
          evidence(state, `${p} fixture`, `dns:${p}.example.com`, [
            state === "HEALTHY" ? "policy-good" : "policy-bad",
          ]),
        ]),
      ) as EmailHealthSnapshot["checks"],
    });
    try {
      await db.user.create({ data: { id: userId, email: `email-health-${userId}@example.test` } });
      await db.organization.create({
        data: {
          id: organizationId,
          ownerId: userId,
          slug: organizationId,
          name: "Email health fixture",
        },
      });
      await db.organizationMember.create({
        data: { organizationId, userId, role: "OWNER", status: "ACTIVE" },
      });
      const business = await db.business.create({
        data: { organizationId, name: "Email health fixture" },
      });
      const website = await db.website.create({
        data: {
          organizationId,
          businessId: business.id,
          hostname: "example.com",
          normalizedUrl: "https://example.com",
          verifyStatus: "VERIFIED",
        },
      });
      const monitor = await db.monitor.create({
        data: {
          organizationId,
          websiteId: website.id,
          type: "EMAIL_HEALTH",
          frequencyMinutes: 1440,
        },
      });
      const scope = { organizationId, userId, role: "OWNER" as const };
      await setPreference(scope, userId, "ISSUE", "EMAIL", false);
      const persist = (snapshot: EmailHealthSnapshot) =>
        withGucContext(
          { organizationId },
          (tx) => persistEmailHealth(tx, monitor.id, snapshot),
          db,
        );
      await persist(observation("MISSING"));
      await persist(observation("MISSING"));
      expect(await db.issue.count({ where: { organizationId } })).toBe(3);
      await db.issue.updateMany({
        where: { organizationId },
        data: { firstSeenAt: new Date(Date.now() - 48 * 3600000) },
      });
      const enqueue = vi.fn(async () => randomUUID());
      expect((await enqueueSlaEscalations(scope, enqueue)).notificationsQueued).toBe(3);
      for (const call of enqueue.mock.calls as unknown as Array<Array<{ channel: string }>>)
        expect(call[0]?.channel).toBe("IN_APP");
      await persist(observation("UNKNOWN"));
      expect(await db.issue.count({ where: { organizationId, status: "OPEN" } })).toBe(3);
      expect(
        (await db.monitor.findUniqueOrThrow({ where: { id: monitor.id } })).config,
      ).toMatchObject({
        emailHealth: { checks: { SPF: { state: "UNKNOWN" } } },
        emailLastKnown: { SPF: { state: "MISSING" } },
      });
      const mixed = observation("UNKNOWN");
      mixed.checks.SPF = evidence("HEALTHY", "SPF now valid", "dns:example.com", ["v=spf1 -all"]);
      await persist(mixed);
      expect(await db.issue.count({ where: { organizationId, status: "OPEN" } })).toBe(2);
      await persist(observation("HEALTHY"));
      expect(await db.issue.count({ where: { organizationId, status: "OPEN" } })).toBe(0);
      expect(
        (await db.monitor.findUniqueOrThrow({ where: { id: monitor.id } })).config,
      ).toMatchObject({ emailChanges: ["SPF", "DMARC", "MTA_STS"] });
      const results = await db.monitoringResult.count({ where: { monitorId: monitor.id } });
      await db.monitor.update({ where: { id: monitor.id }, data: { enabled: false } });
      await persist(observation("INVALID"));
      expect(await db.monitoringResult.count({ where: { monitorId: monitor.id } })).toBe(results);
      await db.monitor.update({ where: { id: monitor.id }, data: { enabled: true } });
      fixture.snapshot = observation("INVALID");
      await boss.start();
      await registerMonitorCheckWorker(boss);
      const id = await boss.send("monitor.check", {
        organizationId,
        websiteId: website.id,
        monitorId: monitor.id,
        type: "UPTIME",
      });
      await vi.waitFor(
        async () =>
          expect(await boss.getJobById("monitor.check", id!)).toMatchObject({ state: "completed" }),
        { timeout: 15000 },
      );
      expect(await db.issue.count({ where: { organizationId, status: "OPEN" } })).toBe(3);
      await db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL ROLE guardian_app");
        await tx.$executeRaw`SELECT set_config('app.org_id', ${randomUUID()}, true)`;
        expect(await tx.monitoringResult.count({ where: { monitorId: monitor.id } })).toBe(0);
      });
    } finally {
      await boss.stop({ graceful: true, timeout: 5000 });
      if (!/^email_test_[a-f0-9]{32}$/.test(schema)) throw Error("Invalid test schema");
      await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await db.$executeRaw`DELETE FROM guardian_jobs.sla_dispatch WHERE organization_id = ${organizationId}`;
      await db.organization.deleteMany({ where: { id: organizationId } });
      await db.user.deleteMany({ where: { id: userId } });
      await db.$disconnect();
    }
  },
  60000,
);
