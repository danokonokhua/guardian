import { z } from "zod";

export const states = ["OPERATIONAL", "DEGRADED", "OUTAGE", "MAINTENANCE", "UNKNOWN"] as const;
export const incidentStates = ["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"] as const;
const text = (max: number) => z.string().trim().min(1).max(max);
export const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{2,59}$/);
export const componentSchema = z
  .object({
    id: z.string().uuid(),
    name: text(80),
    state: z.enum(states),
    confirmedAt: z.string().datetime(),
    visible: z.boolean(),
  })
  .strict();
const updateSchema = z
  .object({ at: z.string().datetime(), status: z.enum(incidentStates), summary: text(1500) })
  .strict();
const incidentSchema = z
  .object({
    id: z.string().uuid(),
    title: text(120),
    componentIds: z.array(z.string().uuid()).min(1).max(20),
    updates: z.array(updateSchema).min(1).max(100),
  })
  .strict();
const maintenanceSchema = z
  .object({
    id: z.string().uuid(),
    title: text(120),
    summary: text(1500),
    componentIds: z.array(z.string().uuid()).min(1).max(20),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    cancelled: z.boolean(),
  })
  .strict();
export const documentSchema = z
  .object({
    name: text(100),
    description: z.string().trim().max(500),
    notifyTransitions: z.boolean(),
    components: z.array(componentSchema).max(20),
    incidents: z.array(incidentSchema).max(100),
    maintenance: z.array(maintenanceSchema).max(100),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type StatusDocument = z.infer<typeof documentSchema>;
export const createSchema = z.object({ name: text(100), slug: slugSchema }).strict();
const version = z.number().int().positive();
export const commandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("settings"),
      version,
      name: text(100),
      description: z.string().trim().max(500),
      notifyTransitions: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("component"),
      version,
      id: z.string().uuid().optional(),
      name: text(80),
      state: z.enum(states),
      visible: z.boolean(),
    })
    .strict(),
  z.object({ action: z.literal("publish"), version }).strict(),
  z.object({ action: z.literal("unpublish"), version }).strict(),
  z
    .object({
      action: z.literal("incident"),
      version,
      title: text(120),
      summary: text(1500),
      componentIds: z.array(z.string().uuid()).min(1).max(20),
    })
    .strict(),
  z
    .object({
      action: z.literal("update"),
      version,
      id: z.string().uuid(),
      status: z.enum(incidentStates),
      summary: text(1500),
    })
    .strict(),
  z.object({ action: z.literal("redact"), version, id: z.string().uuid() }).strict(),
  z.object({ action: z.literal("redact-maintenance"), version, id: z.string().uuid() }).strict(),
  z
    .object({
      action: z.literal("maintenance"),
      version,
      title: text(120),
      summary: text(1500),
      componentIds: z.array(z.string().uuid()).min(1).max(20),
      startsAt: z.string().datetime(),
      endsAt: z.string().datetime(),
    })
    .strict(),
  z.object({ action: z.literal("cancel-maintenance"), version, id: z.string().uuid() }).strict(),
]);
export type StatusCommand = z.infer<typeof commandSchema>;

// Explicit allowlist: never serialize the tenant model, audit actor or internal monitoring data.
export function publicDocument(input: StatusDocument): StatusDocument {
  const doc = documentSchema.parse(input);
  const components = doc.components.filter((c) => c.visible);
  const ids = new Set(components.map((c) => c.id));
  return {
    name: doc.name,
    description: doc.description,
    notifyTransitions: false,
    updatedAt: doc.updatedAt,
    components,
    incidents: doc.incidents.filter((i) => i.componentIds.every((id) => ids.has(id))),
    maintenance: doc.maintenance.filter((m) => m.componentIds.every((id) => ids.has(id))),
  };
}

export function serviceState(
  doc: StatusDocument,
  component: StatusDocument["components"][number],
  now = Date.now(),
) {
  const stale = now - Date.parse(component.confirmedAt) > 24 * 60 * 60 * 1000;
  const maintenance = doc.maintenance.some(
    (m) =>
      !m.cancelled &&
      m.componentIds.includes(component.id) &&
      Date.parse(m.startsAt) <= now &&
      now < Date.parse(m.endsAt),
  );
  // Known outages/degradation must never disappear behind a maintenance window.
  const state = stale ? "UNKNOWN" : component.state;
  return {
    state: maintenance && !["OUTAGE", "DEGRADED"].includes(state) ? "MAINTENANCE" : state,
    stale,
  };
}
