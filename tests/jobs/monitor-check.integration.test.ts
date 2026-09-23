import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { PgBoss } from "pg-boss";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { withGucContext, withTenantTransaction, type TenantScope } from "@/db/tenant";
import { JOB_SCHEMA, MONITOR_CHECK_JOB } from "@/lib/jobs/constants";
import { registerMonitorCheckWorker } from "@/lib/jobs/monitor-check";
import { upsertMonitorDispatch, deleteMonitorDispatch } from "@/lib/jobs/dispatch";
import { scheduleDueMonitors } from "@/lib/jobs/scheduler";
import {
  registerNotificationWorker,
  productionNotificationProvider,
  enqueueNotification,
} from "@/lib/notifications";
import { enqueueSlaEscalations } from "@/services/issues/escalation";
import { setPreference } from "@/services/notifications/repository";

const TEST_DATABASE_URL = process.env["TEST_DATABASE_URL"];
const RLS_DATABASE_URL = TEST_DATABASE_URL?.replace(
  "postgresql://postgres:postgres@",
  "postgresql://guardian_app:postgres@",
);

// New identities avoid collisions with retained pg-boss singleton windows
// when this suite runs repeatedly against the same disposable database.
const ORG_ID = randomUUID();
const USER_ID = randomUUID();
const BUSINESS_ID = randomUUID();
const WEBSITE_ID = randomUUID();
const MONITOR_ID = randomUUID();
const DOWN_WEBSITE_ID = randomUUID();
const DOWN_MONITOR_ID = randomUUID();
const scope: TenantScope = { organizationId: ORG_ID, userId: USER_ID, role: "OWNER" };

// This suite tests real PostgreSQL/queue/lifecycle behavior against a local
// HTTP fixture. Substitute ONLY the outbound boundary; production SSRF guards
// remain unchanged and are independently tested in outbound-url.test.ts.
const fixture = vi.hoisted(() => ({ origin: "" }));
vi.mock("@/lib/security/outbound-url", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/security/outbound-url")>()),
  requestSafeOutbound: async (url: string, options: { method?: string; timeoutMs?: number }) => {
    if (!fixture.origin || new URL(url).origin !== fixture.origin) {
      throw new Error("Integration request is outside the local fixture");
    }
    const response = await fetch(url, {
      method: options.method,
      redirect: "manual",
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
    });
    return { ok: response.ok, status: response.status, headers: {}, text: () => response.text() };
  },
}));

describe.skipIf(TEST_DATABASE_URL === undefined)(
  "monitor.check worker (live PostgreSQL integration)",
  () => {
    let prisma: PrismaClient;
    let boss: PgBoss;
    let server: Server;
    let websiteUrl: string;
    let down = true;

    beforeAll(async () => {
      prisma = new PrismaClient({ datasources: { db: { url: RLS_DATABASE_URL } } });
      await prisma.user.create({ data: { id: USER_ID, email: "monitor-worker@example.test" } });
      await withGucContext(
        { organizationId: ORG_ID, userId: USER_ID },
        async (tx) => {
          await tx.organization.create({
            data: { id: ORG_ID, name: "Monitor Worker", slug: "monitor-worker", ownerId: USER_ID },
          });
          await tx.organizationMember.create({
            data: { organizationId: ORG_ID, userId: USER_ID, role: "OWNER", status: "ACTIVE" },
          });
          await tx.business.create({
            data: { id: BUSINESS_ID, organizationId: ORG_ID, name: "Worker Site" },
          });
        },
        prisma,
      );

      server = createServer((request, response) => {
        const isDown = request.url === "/down" && down;
        response.writeHead(isDown ? 503 : 200, { "content-type": "text/plain" });
        response.end("ok");
      });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (address === null || typeof address === "string")
        throw new Error("Test server failed to start");
      websiteUrl = `http://127.0.0.1:${address.port}/health`;
      fixture.origin = new URL(websiteUrl).origin;

      await withTenantTransaction(
        scope,
        async (tx) => {
          await tx.website.create({
            data: {
              id: WEBSITE_ID,
              organizationId: ORG_ID,
              businessId: BUSINESS_ID,
              normalizedUrl: websiteUrl,
              hostname: "down.localhost",
              status: "ACTIVE",
              verifyStatus: "VERIFIED",
            },
          });
          await tx.monitor.create({
            data: {
              id: MONITOR_ID,
              organizationId: ORG_ID,
              websiteId: WEBSITE_ID,
              type: "UPTIME",
              enabled: true,
              frequencyMinutes: 5,
            },
          });
          await tx.website.create({
            data: {
              id: DOWN_WEBSITE_ID,
              organizationId: ORG_ID,
              businessId: BUSINESS_ID,
              normalizedUrl: `${websiteUrl.replace("/health", "")}/down`,
              hostname: "127.0.0.1",
              label: "Down test",
              status: "ACTIVE",
              verifyStatus: "VERIFIED",
            },
          });
          await tx.monitor.create({
            data: {
              id: DOWN_MONITOR_ID,
              organizationId: ORG_ID,
              websiteId: DOWN_WEBSITE_ID,
              type: "UPTIME",
              enabled: true,
              frequencyMinutes: 5,
            },
          });
        },
        prisma,
      );

      boss = new PgBoss({
        connectionString: TEST_DATABASE_URL,
        schema: JOB_SCHEMA,
        useListenNotify: false,
        application_name: "guardian-monitor-worker-test",
      });
      await boss.start();
      await registerMonitorCheckWorker(boss);
      await registerNotificationWorker(boss, productionNotificationProvider);
      // No messages are sent to external email providers during validation.
      await setPreference(scope, USER_ID, "ISSUE", "EMAIL", false);
    });

    afterAll(async () => {
      await boss?.stop({ graceful: true, timeout: 5_000 });
      if (prisma !== undefined) {
        await withGucContext(
          { organizationId: ORG_ID, userId: USER_ID },
          async (tx) => {
            await deleteMonitorDispatch(tx, MONITOR_ID);
            await tx.inAppNotification.deleteMany({ where: { organizationId: ORG_ID } });
            await tx.notificationPreference.deleteMany({ where: { organizationId: ORG_ID } });
            await tx.monitor.deleteMany({ where: { id: MONITOR_ID } });
            await tx.monitor.deleteMany({ where: { id: DOWN_MONITOR_ID } });
            await tx.website.deleteMany({ where: { id: WEBSITE_ID } });
            await tx.website.deleteMany({ where: { id: DOWN_WEBSITE_ID } });
            await tx.business.deleteMany({ where: { id: BUSINESS_ID } });
            await tx.organizationMember.deleteMany({ where: { organizationId: ORG_ID } });
            await tx.organization.deleteMany({ where: { id: ORG_ID } });
          },
          prisma,
        );
        await prisma.user.delete({ where: { id: USER_ID } });
        await prisma.$disconnect();
      }
      await new Promise<void>((resolve) => server?.close(() => resolve()));
    });

    it("executes an enqueued check and records an UP result", async () => {
      await upsertMonitorDispatch(prisma, {
        organizationId: ORG_ID,
        websiteId: WEBSITE_ID,
        monitorId: MONITOR_ID,
        type: "UPTIME",
        enabled: true,
        frequencyMinutes: 5,
      });
      expect(await scheduleDueMonitors(boss)).toBe(1);
      expect(await scheduleDueMonitors(boss)).toBe(0);

      let completed = false;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const monitor = await withTenantTransaction(
          scope,
          (tx) =>
            tx.monitoringResult.findFirst({
              where: { monitorId: MONITOR_ID },
              orderBy: { checkedAt: "desc" },
            }),
          prisma,
        );
        if (monitor?.status === "UP" && monitor.httpStatusCode === 200) {
          completed = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(completed).toBe(true);
    }, 20_000);

    it("deduplicates repeated failures and delivers one in-app SLA notification", async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const before = await withTenantTransaction(
          scope,
          (tx) => tx.monitoringResult.count({ where: { monitorId: DOWN_MONITOR_ID } }),
          prisma,
        );
        await boss.send(MONITOR_CHECK_JOB, {
          organizationId: ORG_ID,
          websiteId: DOWN_WEBSITE_ID,
          monitorId: DOWN_MONITOR_ID,
          type: "UPTIME",
        });
        await vi.waitFor(
          async () => {
            const count = await withTenantTransaction(
              scope,
              (tx) => tx.monitoringResult.count({ where: { monitorId: DOWN_MONITOR_ID } }),
              prisma,
            );
            expect(count).toBeGreaterThan(before);
            const issue = await withTenantTransaction(
              scope,
              (tx) => tx.issue.findFirst({ where: { monitorId: DOWN_MONITOR_ID, status: "OPEN" } }),
              prisma,
            );
            expect(issue).not.toBeNull();
          },
          { timeout: 15_000, interval: 250 },
        );
      }
      const issues = await withTenantTransaction(
        scope,
        (tx) => tx.issue.findMany({ where: { monitorId: DOWN_MONITOR_ID } }),
        prisma,
      );
      expect(issues).toHaveLength(1);
      expect(issues[0]?.ruleId).toBe("monitor.http_status");
      await withTenantTransaction(
        scope,
        (tx) =>
          tx.issue.update({
            where: { id: issues[0]!.id },
            data: { firstSeenAt: new Date(Date.now() - 7 * 86400_000) },
          }),
        prisma,
      );
      const enqueue = (event: Parameters<typeof enqueueNotification>[0]) =>
        enqueueNotification(event, boss);
      expect((await enqueueSlaEscalations(scope, enqueue)).notificationsQueued).toBe(1);
      expect((await enqueueSlaEscalations(scope, enqueue)).notificationsQueued).toBe(0);
      await vi.waitFor(
        async () => {
          const notifications = await withTenantTransaction(
            scope,
            (tx) => tx.inAppNotification.findMany({ where: { userId: USER_ID } }),
            prisma,
          );
          expect(notifications).toHaveLength(1);
          expect(notifications[0]?.title).toContain("SLA breach:");
        },
        { timeout: 15_000, interval: 250 },
      );
      // The new runtime grants must not bypass tenant isolation.
      expect(await prisma.inAppNotification.findMany()).toHaveLength(0);
      expect(await prisma.notificationPreference.findMany()).toHaveLength(0);
      const otherTenant = await withGucContext(
        { organizationId: "dddddddd-0000-4000-8000-000000000004" },
        async (tx) => ({
          notifications: await tx.inAppNotification.findMany(),
          preferences: await tx.notificationPreference.findMany(),
        }),
        prisma,
      );
      expect(otherTenant.notifications).toHaveLength(0);
      expect(otherTenant.preferences).toHaveLength(0);
    }, 55_000);

    it("recovers the HTTP incident and records resolution history", async () => {
      down = false;
      await boss.send(MONITOR_CHECK_JOB, {
        organizationId: ORG_ID,
        websiteId: DOWN_WEBSITE_ID,
        monitorId: DOWN_MONITOR_ID,
        type: "UPTIME",
      });
      await vi.waitFor(
        async () => {
          const issue = await withTenantTransaction(
            scope,
            (tx) =>
              tx.issue.findFirst({
                where: { monitorId: DOWN_MONITOR_ID },
                include: { activities: true },
              }),
            prisma,
          );
          expect(issue?.status).toBe("RESOLVED");
          expect(issue?.resolvedAt).toBeInstanceOf(Date);
          expect(issue?.activities.some((activity) => activity.action === "RESOLVED")).toBe(true);
        },
        { timeout: 15_000, interval: 250 },
      );
      const latest = await withTenantTransaction(
        scope,
        (tx) =>
          tx.monitoringResult.findFirst({
            where: { monitorId: DOWN_MONITOR_ID },
            orderBy: { checkedAt: "desc" },
          }),
        prisma,
      );
      expect(latest?.status).toBe("UP");
      expect(latest?.httpStatusCode).toBe(200);
      expect(
        (await enqueueSlaEscalations(scope, (event) => enqueueNotification(event, boss)))
          .notificationsQueued,
      ).toBe(0);
    }, 20_000);

    it("reopens the same incident when the website fails again", async () => {
      down = true;
      const jobId = await boss.send(MONITOR_CHECK_JOB, {
        organizationId: ORG_ID,
        websiteId: DOWN_WEBSITE_ID,
        monitorId: DOWN_MONITOR_ID,
        type: "UPTIME",
      });
      expect(jobId).toMatch(/^[0-9a-f-]{36}$/i);

      // Leave headroom for assertions before the 20-second framework deadline.
      const deadline = Date.now() + 15_000;
      let issueFound = false;
      while (Date.now() < deadline) {
        const snapshot = await withTenantTransaction(
          scope,
          async (tx) => ({
            result: await tx.monitoringResult.findFirst({
              where: { monitorId: DOWN_MONITOR_ID },
              orderBy: { checkedAt: "desc" },
            }),
            issue: await tx.issue.findFirst({
              where: { monitorId: DOWN_MONITOR_ID, status: "OPEN" },
            }),
          }),
          prisma,
        );
        if (snapshot.result?.status === "DOWN" && snapshot.issue !== null) {
          issueFound = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      expect(
        issueFound,
        "monitor worker did not persist a DOWN result and open an issue within 15s",
      ).toBe(true);
      const issues = await withTenantTransaction(
        scope,
        (tx) =>
          tx.issue.findMany({
            where: { monitorId: DOWN_MONITOR_ID },
            include: { activities: true },
          }),
        prisma,
      );
      expect(issues).toHaveLength(1);
      expect(issues[0]?.activities.some((activity) => activity.action === "REOPENED")).toBe(true);
    }, 20_000);
  },
);
