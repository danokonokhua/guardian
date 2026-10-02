import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getPrisma } from "@/db/client";
import { withTenantTransaction, type TenantScope } from "@/db/tenant";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { parseWith } from "@/lib/validation";
import {
  commandSchema,
  createSchema,
  documentSchema,
  publicDocument,
  slugSchema,
  type StatusDocument,
} from "@/lib/status-pages/model";
import { startJobBoss } from "@/lib/jobs/boss";
import { EXTERNAL_NOTIFICATION_JOB, sendDeliveryJob } from "@/lib/notification-destinations/queue";

function authorize(scope: TenantScope) {
  if (!["OWNER", "ADMIN"].includes(scope.role)) throw new ForbiddenError();
}
export async function listStatusPages(scope: TenantScope) {
  return withTenantTransaction(scope, (tx) =>
    tx.statusPage.findMany({
      where: { organizationId: scope.organizationId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  );
}
export async function createStatusPage(scope: TenantScope, input: unknown) {
  authorize(scope);
  const data = parseWith(createSchema, input, "status page");
  try {
    return await withTenantTransaction(scope, async (tx) => {
      await tx.$executeRaw`SELECT id FROM organizations WHERE id = ${scope.organizationId} FOR UPDATE`;
      if ((await tx.statusPage.count({ where: { organizationId: scope.organizationId } })) >= 20)
        throw new ConflictError("An organization can have up to 20 status pages.");
      const page = await tx.statusPage.create({
        data: {
          organizationId: scope.organizationId,
          slug: data.slug,
          document: {
            name: data.name,
            description: "",
            notifyTransitions: false,
            components: [],
            incidents: [],
            maintenance: [],
            updatedAt: new Date().toISOString(),
          },
        },
      });
      await tx.statusPageAudit.create({
        data: {
          organizationId: scope.organizationId,
          pageId: page.id,
          actorId: scope.userId,
          action: "create",
          version: 1,
        },
      });
      return page;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      throw new ConflictError("That public address is unavailable.");
    throw e;
  }
}
export async function editStatusPage(scope: TenantScope, id: string, input: unknown) {
  authorize(scope);
  const command = parseWith(commandSchema, input, "status page change");
  return withTenantTransaction(scope, async (tx) => {
    await tx.$executeRaw`SELECT id FROM status_pages WHERE id = ${id} AND "organizationId" = ${scope.organizationId} FOR UPDATE`;
    const page = await tx.statusPage.findFirst({
      where: { id, organizationId: scope.organizationId },
    });
    if (!page) throw new NotFoundError("Status page");
    if (page.version !== command.version)
      throw new ConflictError("This page changed. Refresh before saving again.");
    const doc = documentSchema.parse(page.document);
    const now = new Date().toISOString();
    let published = page.published;
    let transition: { title: string; body: string } | undefined;
    if (command.action === "settings")
      Object.assign(doc, {
        name: command.name,
        description: command.description,
        notifyTransitions: command.notifyTransitions,
      });
    if (command.action === "component") {
      const existing = command.id ? doc.components.find((c) => c.id === command.id) : undefined;
      if (command.id && !existing) throw new NotFoundError("Component");
      const component = {
        id: existing?.id ?? randomUUID(),
        name: command.name,
        state: command.state,
        visible: command.visible,
        confirmedAt: now,
      };
      if (existing) Object.assign(existing, component);
      else doc.components.push(component);
    }
    if (command.action === "publish") {
      if (!doc.components.some((c) => c.visible))
        throw new ValidationError("Select at least one visible component before publishing.");
      published = true;
    }
    if (command.action === "unpublish") published = false;
    if (command.action === "incident" || command.action === "maintenance") {
      const ids = new Set(doc.components.map((c) => c.id));
      if (command.componentIds.some((componentId) => !ids.has(componentId)))
        throw new ValidationError("Choose components from this page.");
      if (command.action === "incident") {
        doc.incidents.unshift({
          id: randomUUID(),
          title: command.title,
          componentIds: command.componentIds,
          updates: [{ at: now, status: "INVESTIGATING", summary: command.summary }],
        });
        if (
          command.componentIds.every((componentId) =>
            doc.components.some((c) => c.id === componentId && c.visible),
          )
        )
          transition = { title: command.title, body: `INVESTIGATING: ${command.summary}` };
      } else {
        if (
          Date.parse(command.endsAt) <= Date.parse(command.startsAt) ||
          Date.parse(command.endsAt) <= Date.now()
        )
          throw new ValidationError("Maintenance must end after its start and in the future.");
        doc.maintenance.unshift({
          id: randomUUID(),
          title: command.title,
          summary: command.summary,
          componentIds: command.componentIds,
          startsAt: command.startsAt,
          endsAt: command.endsAt,
          cancelled: false,
        });
      }
    }
    if (command.action === "update") {
      const incident = doc.incidents.find((i) => i.id === command.id);
      if (!incident) throw new NotFoundError("Incident");
      const previous = incident.updates.at(-1)!;
      if (previous.status === "RESOLVED")
        throw new ConflictError(
          "Resolved incidents are closed. Create a new incident if service fails again.",
        );
      incident.updates.push({ at: now, status: command.status, summary: command.summary });
      if (
        previous.status !== command.status &&
        incident.componentIds.every((componentId) =>
          doc.components.some((c) => c.id === componentId && c.visible),
        )
      )
        transition = { title: incident.title, body: `${command.status}: ${command.summary}` };
    }
    if (command.action === "redact") {
      if (!doc.incidents.some((i) => i.id === command.id)) throw new NotFoundError("Incident");
      doc.incidents = doc.incidents.filter((i) => i.id !== command.id);
    }
    if (command.action === "cancel-maintenance") {
      const maintenance = doc.maintenance.find((m) => m.id === command.id);
      if (!maintenance) throw new NotFoundError("Maintenance");
      maintenance.cancelled = true;
    }
    if (command.action === "redact-maintenance") {
      if (!doc.maintenance.some((m) => m.id === command.id)) throw new NotFoundError("Maintenance");
      doc.maintenance = doc.maintenance.filter((m) => m.id !== command.id);
    }
    doc.updatedAt = now;
    const validated = parseWith(documentSchema, doc, "status page");
    const nextVersion = page.version + 1;
    const updated = await tx.statusPage.update({
      where: { id },
      data: { document: validated, published, version: nextVersion },
    });
    if (published) {
      const snapshot = publicDocument(validated);
      await tx.publicStatusPage.upsert({
        where: { pageId: id },
        create: {
          pageId: id,
          organizationId: scope.organizationId,
          slug: page.slug,
          document: snapshot,
        },
        update: { document: snapshot },
      });
    } else
      await tx.publicStatusPage.deleteMany({
        where: { pageId: id, organizationId: scope.organizationId },
      });
    await tx.statusPageAudit.create({
      data: {
        organizationId: scope.organizationId,
        pageId: id,
        actorId: scope.userId,
        action: command.action,
        version: nextVersion,
      },
    });
    // Explicit opt-in, published incident transitions only. Maintenance is display-only.
    if (published && doc.notifyTransitions && transition) {
      const destinations = await tx.notificationDestination.findMany({
        where: { organizationId: scope.organizationId, enabled: true },
        select: { id: true },
        take: 20,
      });
      if (destinations.length) {
        const boss = await startJobBoss();
        await boss.createQueue(EXTERNAL_NOTIFICATION_JOB);
        for (const destination of destinations) {
          const delivery = await tx.externalDelivery.create({
            data: {
              organizationId: scope.organizationId,
              destinationId: destination.id,
              dedupKey: `status:${id}:${nextVersion}`,
              statusMessage: {
                pageId: id,
                version: nextVersion,
                title: transition.title,
                body: transition.body,
              },
            },
          });
          await sendDeliveryJob(tx, boss, scope.organizationId, delivery.id);
        }
      }
    }
    return updated;
  });
}
export async function readPublicStatusPage(slug: string): Promise<StatusDocument | null> {
  if (!slugSchema.safeParse(slug).success) return null;
  return getPrisma().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.status_slug', ${slug}, true)`;
    const snapshot = await tx.publicStatusPage.findUnique({
      where: { slug },
      select: { document: true },
    });
    return snapshot ? publicDocument(documentSchema.parse(snapshot.document)) : null;
  });
}
export async function statusAudit(scope: TenantScope, id: string) {
  authorize(scope);
  return withTenantTransaction(scope, (tx) =>
    tx.statusPageAudit.findMany({
      where: { organizationId: scope.organizationId, pageId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { action: true, version: true, createdAt: true, actorId: true },
    }),
  );
}
