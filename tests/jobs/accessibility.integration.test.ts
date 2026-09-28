import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PgBoss } from "pg-boss";
import { expect, it, vi } from "vitest";
const fetchPage = vi.hoisted(() => vi.fn());
vi.mock("@/lib/security/outbound-url", async (original) => ({
  ...(await original<typeof import("@/lib/security/outbound-url")>()),
  requestSafeOutbound: fetchPage,
}));
import { withGucContext } from "@/db/tenant";
import { persistAccessibility } from "@/lib/jobs/accessibility-check";
import { analyzeAccessibility } from "@/lib/accessibility/analyze";
import type { AccessibilitySnapshot } from "@/lib/accessibility/types";
import { registerMonitorCheckWorker } from "@/lib/jobs/monitor-check";
import { enqueueSlaEscalations } from "@/services/issues/escalation";
import { setPreference } from "@/services/notifications/repository";
import { updateMonitor } from "@/services/monitors/repository";
it.skipIf(process.env.ACCESSIBILITY_LIVE_TEST !== "1")(
  "persists bounded evidence, keeps unknown findings open, resolves complete scans and runs the queued adapter",
  async () => {
    const db = new PrismaClient(),
      organizationId = randomUUID(),
      userId = randomUUID();
    const schema = "access_test_" + randomUUID().replaceAll("-", "");
    const boss = new PgBoss({
      connectionString: process.env.DATABASE_URL!,
      schema,
      useListenNotify: false,
    });
    let time = Date.now() - 20000;
    const url = "https://example.com/";
    const bad = '<html lang="en"><title>Example</title><input><img></html>',
      good = '<html lang="en"><title>Example</title><label>Name<input></label><img alt=""></html>';
    const snapshot = (html: string) =>
      analyzeAccessibility(html, url, new Date((time += 1000)).toISOString());
    try {
      await db.user.create({ data: { id: userId, email: `access-${userId}@example.test` } });
      await db.organization.create({
        data: {
          id: organizationId,
          ownerId: userId,
          slug: organizationId,
          name: "Accessibility fixture",
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
          hostname: "example.com",
          normalizedUrl: url,
          verifyStatus: "VERIFIED",
        },
      });
      const monitor = await db.monitor.create({
        data: {
          organizationId,
          websiteId: website.id,
          type: "ACCESSIBILITY",
          frequencyMinutes: 1440,
        },
      });
      const scope = { organizationId, userId, role: "OWNER" as const };
      await setPreference(scope, userId, "ISSUE", "EMAIL", false);
      const persist = (observation: AccessibilitySnapshot) =>
        withGucContext(
          { organizationId },
          (tx) => persistAccessibility(tx, monitor.id, url, observation),
          db,
        );
      const first = snapshot(bad);
      await Promise.all([persist(first), persist(first)]);
      expect(await db.monitoringResult.count({ where: { monitorId: monitor.id } })).toBe(1);
      await persist(snapshot(bad));
      expect(await db.issue.count({ where: { organizationId } })).toBe(2);
      const unknown = {
        ...snapshot(good),
        state: "UNKNOWN" as const,
        findings: [],
        reason: "Request timed out",
      };
      await persist(unknown);
      expect(await db.issue.count({ where: { organizationId, status: "OPEN" } })).toBe(2);
      expect(
        (await db.monitor.findUniqueOrThrow({ where: { id: monitor.id } })).config,
      ).toMatchObject({
        accessibility: { state: "UNKNOWN" },
        accessibilityLastKnown: { state: "CHECKED", findings: expect.any(Array) },
      });
      await db.issue.updateMany({
        where: { organizationId },
        data: { firstSeenAt: new Date(Date.now() - 48 * 3600000) },
      });
      const enqueue = vi.fn(async () => randomUUID());
      expect((await enqueueSlaEscalations(scope, enqueue)).notificationsQueued).toBe(2);
      await persist(snapshot(good));
      expect(await db.issue.count({ where: { organizationId, status: "OPEN" } })).toBe(0);
      await persist(first);
      expect(await db.issue.count({ where: { organizationId, status: "OPEN" } })).toBe(0);
      await expect(
        updateMonitor(scope, monitor.id, { config: { accessibility: { state: "CHECKED" } } }),
      ).rejects.toMatchObject({ status: 409 });
      await expect(updateMonitor(scope, monitor.id, { frequencyMinutes: 5 })).rejects.toMatchObject(
        { status: 409 },
      );
      const count = await db.monitoringResult.count({ where: { monitorId: monitor.id } });
      await db.monitor.update({ where: { id: monitor.id }, data: { enabled: false } });
      await persist(snapshot(bad));
      expect(await db.monitoringResult.count({ where: { monitorId: monitor.id } })).toBe(count);
      await db.monitor.update({ where: { id: monitor.id }, data: { enabled: true } });
      await db.website.update({ where: { id: website.id }, data: { verifyStatus: "PENDING" } });
      await persist(snapshot(bad));
      expect(await db.monitoringResult.count({ where: { monitorId: monitor.id } })).toBe(count);
      await db.website.update({ where: { id: website.id }, data: { verifyStatus: "VERIFIED" } });
      fetchPage.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { "content-type": "text/html" },
        text: async () => bad,
      });
      await boss.start();
      await registerMonitorCheckWorker(boss);
      const job = await boss.send("monitor.check", {
        organizationId,
        websiteId: website.id,
        monitorId: monitor.id,
        type: "UPTIME",
      });
      await vi.waitFor(
        async () =>
          expect(await boss.getJobById("monitor.check", job!)).toMatchObject({
            state: "completed",
          }),
        { timeout: 15000 },
      );
      expect(fetchPage).toHaveBeenCalledOnce();
      expect(await db.issue.count({ where: { organizationId, status: "OPEN" } })).toBe(2);
      await db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL ROLE guardian_app");
        await tx.$executeRaw`SELECT set_config('app.org_id', ${randomUUID()}, true)`;
        expect(await tx.monitoringResult.count({ where: { monitorId: monitor.id } })).toBe(0);
      });
    } finally {
      await boss.stop({ graceful: true, timeout: 5000 });
      if (/^access_test_[a-f0-9]{32}$/.test(schema))
        await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await db.$executeRaw`DELETE FROM guardian_jobs.sla_dispatch WHERE organization_id = ${organizationId}`;
      await db.$executeRaw`DELETE FROM guardian_jobs.monitor_dispatch WHERE organization_id = ${organizationId}`;
      await db.organization.deleteMany({ where: { id: organizationId } });
      await db.user.deleteMany({ where: { id: userId } });
      await db.$disconnect();
    }
  },
  60000,
);
