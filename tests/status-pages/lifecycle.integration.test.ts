import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PgBoss } from "pg-boss";
import { expect, it, vi } from "vitest";
const seam = vi.hoisted(() => ({ start: vi.fn() }));
vi.mock("@/lib/jobs/boss", () => ({ startJobBoss: seam.start }));
import {
  createStatusPage,
  editStatusPage,
  listStatusPages,
  readPublicStatusPage,
  statusAudit,
} from "@/services/status-pages";
import { deliverExternal } from "@/lib/notification-destinations/worker";
import { documentSchema } from "@/lib/status-pages/model";
import { encryptDestination } from "@/lib/notification-destinations/secrets";
it.skipIf(process.env.STATUS_PAGES_LIVE_TEST !== "1")(
  "isolates private content, publishes approved snapshots, audits edits and cancels withdrawn notifications",
  async () => {
    const db = new PrismaClient(),
      org = randomUUID(),
      other = randomUUID(),
      user = randomUUID();
    const schema = "status_test_" + randomUUID().replaceAll("-", "");
    const boss = new PgBoss({
      connectionString: process.env.DATABASE_URL!,
      schema,
      useListenNotify: false,
    });
    const scope = { organizationId: org, userId: user, role: "OWNER" as const };
    try {
      await db.user.create({ data: { id: user, email: `status-${user}@example.test` } });
      for (const id of [org, other])
        await db.organization.create({
          data: { id, ownerId: user, name: "Status fixture", slug: id },
        });
      await boss.start();
      seam.start.mockResolvedValue(boss);
      await expect(
        createStatusPage({ ...scope, role: "MEMBER" }, { name: "No", slug: "not-allowed" }),
      ).rejects.toMatchObject({ status: 403 });
      let page = await createStatusPage(scope, {
        name: "Approved client page",
        slug: `status-${org}`,
      });
      const id = page.id;
      expect(page.published).toBe(false);
      expect(await readPublicStatusPage(page.slug)).toBeNull();
      expect(await listStatusPages({ ...scope, organizationId: other })).toEqual([]);
      await expect(
        editStatusPage({ ...scope, organizationId: other }, id, {
          action: "publish",
          version: page.version,
        }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        editStatusPage(scope, id, { action: "publish", version: page.version }),
      ).rejects.toMatchObject({ status: 400 });
      async function edit(command: Record<string, unknown>) {
        page = await editStatusPage(scope, id, { ...command, version: page.version });
        return documentSchema.parse(page.document);
      }
      let doc = await edit({
        action: "component",
        name: "Website",
        state: "OPERATIONAL",
        visible: true,
      });
      const component = doc.components[0]!;
      doc = await edit({
        action: "component",
        name: "PRIVATE DATABASE",
        state: "OUTAGE",
        visible: false,
      });
      const hidden = doc.components[1]!;
      await edit({
        action: "incident",
        title: "SECRET CUSTOMER",
        summary: "TOKEN123",
        componentIds: [hidden.id],
      });
      await edit({ action: "publish" });
      let publicPage = await readPublicStatusPage(page.slug);
      expect(publicPage?.components).toHaveLength(1);
      expect(JSON.stringify(publicPage)).not.toMatch(
        /PRIVATE|SECRET|TOKEN123|organizationId|actorId/,
      );
      const oldVersion = page.version;
      const results = await Promise.allSettled([
        editStatusPage(scope, id, {
          action: "component",
          version: oldVersion,
          id: component.id,
          name: "Website",
          state: "DEGRADED",
          visible: true,
        }),
        editStatusPage(scope, id, {
          action: "component",
          version: oldVersion,
          id: component.id,
          name: "Website",
          state: "OUTAGE",
          visible: true,
        }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      page = (await listStatusPages(scope))[0]!;
      await expect(
        editStatusPage(scope, id, {
          action: "maintenance",
          version: page.version,
          title: "Bad dates",
          summary: "Bad",
          componentIds: [component.id],
          startsAt: new Date(Date.now() + 60000).toISOString(),
          endsAt: new Date().toISOString(),
        }),
      ).rejects.toMatchObject({ status: 400 });
      const destinationId = randomUUID();
      doc = await edit({
        action: "maintenance",
        title: "Approved maintenance",
        summary: "Window description",
        componentIds: [component.id],
        startsAt: new Date(Date.now() + 60000).toISOString(),
        endsAt: new Date(Date.now() + 120000).toISOString(),
      });
      const maintenance = doc.maintenance[0]!;
      await edit({ action: "cancel-maintenance", id: maintenance.id });
      expect((await readPublicStatusPage(page.slug))?.maintenance[0]?.cancelled).toBe(true);
      await edit({ action: "redact-maintenance", id: maintenance.id });
      expect((await readPublicStatusPage(page.slug))?.maintenance).toEqual([]);
      await db.notificationDestination.create({
        data: {
          id: destinationId,
          organizationId: org,
          name: "No network fixture",
          channel: "WEBHOOK",
          host: "example.test",
          credentials: encryptDestination(
            { url: "https://example.test/no-send", signingSecret: "test-secret".repeat(4) },
            `${org}:${destinationId}`,
          ),
          enabled: true,
        },
      });
      await edit({
        action: "settings",
        name: "Approved client page",
        description: "Public description",
        notifyTransitions: true,
      });
      doc = await edit({
        action: "incident",
        title: "Website disruption",
        summary: "We are investigating",
        componentIds: [component.id],
      });
      const incident = doc.incidents[0]!;
      expect(await db.externalDelivery.count({ where: { organizationId: org } })).toBe(1);
      await edit({
        action: "update",
        id: incident.id,
        status: "INVESTIGATING",
        summary: "Investigation continues",
      });
      expect(await db.externalDelivery.count({ where: { organizationId: org } })).toBe(1);
      await edit({
        action: "update",
        id: incident.id,
        status: "RESOLVED",
        summary: "Service restored",
      });
      expect(await db.externalDelivery.count({ where: { organizationId: org } })).toBe(2);
      await expect(
        editStatusPage(scope, id, {
          action: "update",
          version: page.version,
          id: incident.id,
          status: "INVESTIGATING",
          summary: "Cannot reopen",
        }),
      ).rejects.toMatchObject({ status: 409 });
      publicPage = await readPublicStatusPage(page.slug);
      expect(publicPage?.incidents[0]?.updates.at(-1)?.status).toBe("RESOLVED");
      const latestDelivery = await db.externalDelivery.findFirstOrThrow({
        where: { organizationId: org },
        orderBy: { createdAt: "desc" },
      });
      const accepted = vi.fn(async () => ({ ok: true, retryable: false, status: 204 }));
      await deliverExternal(org, latestDelivery.id, boss, accepted);
      expect(accepted).toHaveBeenCalledWith(
        "WEBHOOK",
        expect.any(Object),
        expect.objectContaining({
          event: "guardian.status",
          test: false,
          body: "RESOLVED: Service restored",
        }),
      );
      // Actual restricted database role: public slug grants no private-table access or write authority.
      await db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL ROLE guardian_app");
        await tx.$executeRaw`SELECT set_config('app.status_slug', ${page.slug}, true)`;
        expect(await tx.statusPage.findMany()).toEqual([]);
        expect(await tx.statusPageAudit.findMany()).toEqual([]);
        expect(await tx.publicStatusPage.findMany()).toHaveLength(1);
        expect((await tx.publicStatusPage.deleteMany({ where: { pageId: id } })).count).toBe(0);
        await tx.$executeRaw`SELECT set_config('app.status_slug', ${"unpublished-slug"}, true)`;
        expect(await tx.publicStatusPage.findMany()).toEqual([]);
      });
      await edit({ action: "redact", id: incident.id });
      expect((await readPublicStatusPage(page.slug))?.incidents).toEqual([]);
      await edit({ action: "unpublish" });
      expect(await readPublicStatusPage(page.slug)).toBeNull();
      const send = vi.fn();
      for (const delivery of await db.externalDelivery.findMany({ where: { organizationId: org } }))
        await deliverExternal(org, delivery.id, boss, send);
      expect(send).not.toHaveBeenCalled();
      expect(
        await db.externalDelivery.count({ where: { organizationId: org, status: "CANCELLED" } }),
      ).toBe(1);
      const audit = await statusAudit(scope, id);
      expect(audit.map((a) => a.action)).toContain("redact");
      expect(audit.map((a) => a.action)).toContain("unpublish");
      expect(JSON.stringify(audit)).not.toMatch(/TOKEN123|SECRET CUSTOMER/);
    } finally {
      await boss.stop({ graceful: true });
      await db.organization.deleteMany({ where: { id: { in: [org, other] } } });
      await db.user.deleteMany({ where: { id: user } });
      if (/^status_test_[a-f0-9]{32}$/.test(schema))
        await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await db.$disconnect();
    }
  },
  60000,
);
