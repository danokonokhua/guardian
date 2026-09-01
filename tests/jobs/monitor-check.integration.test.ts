import { createServer, type Server } from "node:http";

import { PrismaClient } from "@prisma/client";
import { PgBoss } from "pg-boss";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { withGucContext, withTenantTransaction, type TenantScope } from "@/db/tenant";
import { JOB_SCHEMA, MONITOR_CHECK_JOB } from "@/lib/jobs/constants";
import { registerMonitorCheckWorker } from "@/lib/jobs/monitor-check";

const TEST_DATABASE_URL = process.env["TEST_DATABASE_URL"];
const RLS_DATABASE_URL = TEST_DATABASE_URL?.replace(
  "postgresql://postgres:postgres@",
  "postgresql://guardian_app:postgres@",
);

const ORG_ID = "cccccccc-0000-4000-8000-000000000003";
const USER_ID = "cccccccc-1111-4111-8111-111111111113";
const BUSINESS_ID = "cccccccc-2222-4222-8222-222222222223";
const WEBSITE_ID = "cccccccc-3333-4333-8333-333333333333";
const MONITOR_ID = "cccccccc-4444-4444-8444-444444444444";
const DOWN_WEBSITE_ID = "cccccccc-5555-4555-8555-555555555555";
const DOWN_MONITOR_ID = "cccccccc-6666-4666-8666-666666666666";
const scope: TenantScope = { organizationId: ORG_ID, userId: USER_ID, role: "OWNER" };

describe.skipIf(TEST_DATABASE_URL === undefined)(
  "monitor.check worker (live PostgreSQL integration)",
  () => {
    let prisma: PrismaClient;
    let boss: PgBoss;
    let server: Server;
    let websiteUrl: string;

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
        const isDown = request.url === "/down";
        response.writeHead(isDown ? 503 : 200, { "content-type": "text/plain" });
        response.end("ok");
      });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (address === null || typeof address === "string")
        throw new Error("Test server failed to start");
      websiteUrl = `http://127.0.0.1:${address.port}/health`;

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
    });

    afterAll(async () => {
      await boss?.stop({ graceful: true, timeout: 5_000 });
      if (prisma !== undefined) {
        await withGucContext(
          { organizationId: ORG_ID, userId: USER_ID },
          async (tx) => {
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

    it("executes an enqueued check and records the result", async () => {
      const jobId = await boss.send(MONITOR_CHECK_JOB, {
        organizationId: ORG_ID,
        websiteId: WEBSITE_ID,
        monitorId: MONITOR_ID,
        type: "UPTIME",
      });
      expect(jobId).toMatch(/^[0-9a-f-]{36}$/i);

      let completed = false;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const monitor = await withTenantTransaction(
          scope,
          (tx) => tx.monitor.findUnique({ where: { id: MONITOR_ID }, select: { lastRunAt: true } }),
          prisma,
        );
        if (monitor?.lastRunAt !== null && monitor?.lastRunAt !== undefined) {
          completed = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(completed).toBe(true);
    });

    it("persists a failed result and opens a deduplicated issue", async () => {
      const jobId = await boss.send(MONITOR_CHECK_JOB, {
        organizationId: ORG_ID,
        websiteId: DOWN_WEBSITE_ID,
        monitorId: DOWN_MONITOR_ID,
        type: "UPTIME",
      });
      expect(jobId).toMatch(/^[0-9a-f-]{36}$/i);

      let issueFound = false;
      for (let attempt = 0; attempt < 100; attempt += 1) {
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
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(issueFound).toBe(true);
    });
  },
);
