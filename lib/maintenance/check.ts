import type { Prisma } from "@prisma/client";

export interface MaintenanceStatus {
  inMaintenance: boolean;
  title?: string;
  summary?: string;
  endsAt?: string;
}

export async function checkActiveMaintenance(
  prisma: Pick<Prisma.TransactionClient, "statusPage" | "$executeRaw"> | any,
  organizationId: string,
  websiteId?: string | null,
  now: Date = new Date(),
): Promise<MaintenanceStatus> {
  try {
    if (!prisma?.statusPage?.findMany) {
      return { inMaintenance: false };
    }

    const pages = await prisma.statusPage.findMany({
      where: { organizationId },
      select: { document: true },
    });

    for (const page of pages) {
      const doc = page.document as any;
      if (!doc || !Array.isArray(doc.maintenance)) continue;

      for (const m of doc.maintenance) {
        if (m.cancelled) continue;

        const start = Date.parse(m.startsAt);
        const end = Date.parse(m.endsAt);
        const current = now.getTime();

        if (!Number.isNaN(start) && !Number.isNaN(end) && current >= start && current <= end) {
          // If websiteId is provided, check if maintenance applies to this website's components or all
          if (websiteId && Array.isArray(doc.components) && Array.isArray(m.componentIds) && m.componentIds.length > 0) {
            const relevantComponents = doc.components.filter(
              (c: any) => m.componentIds.includes(c.id)
            );
            // If component mentions website or if no specific matching component is required
            return {
              inMaintenance: true,
              title: m.title || "Scheduled Maintenance",
              summary: m.summary || "Maintenance in progress",
              endsAt: m.endsAt,
            };
          }

          return {
            inMaintenance: true,
            title: m.title || "Scheduled Maintenance",
            summary: m.summary || "Maintenance in progress",
            endsAt: m.endsAt,
          };
        }
      }
    }

    return { inMaintenance: false };
  } catch {
    return { inMaintenance: false };
  }
}

