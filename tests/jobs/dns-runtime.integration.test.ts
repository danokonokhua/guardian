import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { expect, it, vi } from "vitest";
import { deleteMonitorDispatch, upsertMonitorDispatch } from "@/lib/jobs/dispatch";

// Requires a running deployed worker connected to DATABASE_URL's database.
// Only this disposable fixture bypasses ownership verification and uses a
// one-minute interval to exercise real recurrence without changing user monitors.
it.skipIf(process.env.DNS_RUNTIME_TEST !== "1")(
  "running worker schedules successive external DNS observations",
  async () => {
    const db = new PrismaClient();
    const organizationId = randomUUID(),
      userId = randomUUID();
    const businessId = randomUUID(),
      websiteId = randomUUID(),
      monitorId = randomUUID();
    try {
      await db.user.create({ data: { id: userId, email: `dns-runtime-${userId}@example.test` } });
      await db.organization.create({
        data: {
          id: organizationId,
          ownerId: userId,
          name: "Disposable DNS runtime test",
          slug: `dns-runtime-${organizationId}`,
        },
      });
      await db.organizationMember.create({
        data: { organizationId, userId, role: "OWNER", status: "ACTIVE" },
      });
      await db.notificationPreference.create({
        data: { organizationId, userId, eventType: "ISSUE", channel: "EMAIL", enabled: false },
      });
      await db.business.create({
        data: { id: businessId, organizationId, name: "DNS runtime test" },
      });
      await db.website.create({
        data: {
          id: websiteId,
          businessId,
          organizationId,
          hostname: "example.com",
          normalizedUrl: "https://example.com",
          verifyStatus: "VERIFIED",
        },
      });
      await db.monitor.create({
        data: { id: monitorId, organizationId, websiteId, type: "DNS", frequencyMinutes: 1 },
      });
      await upsertMonitorDispatch(db, {
        monitorId,
        organizationId,
        websiteId,
        type: "DNS",
        enabled: true,
        frequencyMinutes: 1,
      });
      await vi.waitFor(
        async () => {
          const results = await db.monitoringResult.findMany({
            where: { monitorId },
            orderBy: { checkedAt: "asc" },
          });
          expect(results.length).toBeGreaterThanOrEqual(2);
          expect(results.every((result) => result.status !== "ERROR")).toBe(true);
          expect(results[1]!.checkedAt.getTime() - results[0]!.checkedAt.getTime()).toBeGreaterThan(
            30000,
          );
          const monitor = await db.monitor.findUniqueOrThrow({ where: { id: monitorId } });
          expect(monitor.config).toHaveProperty("baseline.MX", ["0 ."]);
        },
        { timeout: 190000, interval: 1000 },
      );
    } finally {
      await deleteMonitorDispatch(db, monitorId);
      await db.organization.deleteMany({ where: { id: organizationId } });
      await db.user.deleteMany({ where: { id: userId } });
      await db.$disconnect();
    }
  },
  210000,
);
