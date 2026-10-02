import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { publicDocument, serviceState, type StatusDocument } from "@/lib/status-pages/model";
const now = Date.parse("2026-09-28T12:00:00Z");
function fixture(): StatusDocument {
  return {
    name: "Client services",
    description: "Approved summary",
    notifyTransitions: true,
    updatedAt: new Date(now).toISOString(),
    components: [
      {
        id: randomUUID(),
        name: "Website",
        visible: true,
        state: "OPERATIONAL",
        confirmedAt: new Date(now).toISOString(),
      },
      {
        id: randomUUID(),
        name: "Internal billing system",
        visible: false,
        state: "OUTAGE",
        confirmedAt: new Date(now).toISOString(),
      },
    ],
    incidents: [],
    maintenance: [],
  };
}
describe("public status projection", () => {
  it("excludes hidden services and mixed-visibility incidents and maintenance", () => {
    const doc = fixture();
    const ids = doc.components.map((c) => c.id);
    doc.incidents = [
      {
        id: randomUUID(),
        title: "INTERNAL DIAGNOSTICS",
        componentIds: ids,
        updates: [
          { at: doc.updatedAt, status: "INVESTIGATING", summary: "private customer details" },
        ],
      },
    ];
    doc.maintenance = [
      {
        id: randomUUID(),
        title: "Secret migration",
        summary: "private host",
        componentIds: [ids[1]!],
        startsAt: doc.updatedAt,
        endsAt: new Date(now + 3600000).toISOString(),
        cancelled: false,
      },
    ];
    const result = publicDocument(doc);
    expect(result.components).toHaveLength(1);
    expect(result.incidents).toEqual([]);
    expect(result.maintenance).toEqual([]);
    expect(result.notifyTransitions).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/INTERNAL|private|billing/);
  });
  it("rejects accidentally added internal fields instead of serializing them", () => {
    expect(() => publicDocument({ ...fixture(), token: "secret" } as StatusDocument)).toThrow();
  });
  it("does not claim health from stale confirmations", () => {
    const doc = fixture(),
      component = doc.components[0]!;
    expect(serviceState(doc, component, now + 86400000).state).toBe("OPERATIONAL");
    expect(serviceState(doc, component, now + 86400001)).toEqual({ state: "UNKNOWN", stale: true });
  });
  it("applies maintenance only inside its window and does not conceal an outage", () => {
    const doc = fixture(),
      c = doc.components[0]!;
    doc.maintenance = [
      {
        id: randomUUID(),
        title: "Upgrade",
        summary: "Approved",
        componentIds: [c.id],
        startsAt: new Date(now).toISOString(),
        endsAt: new Date(now + 1000).toISOString(),
        cancelled: false,
      },
    ];
    expect(serviceState(doc, c, now - 1).state).toBe("OPERATIONAL");
    expect(serviceState(doc, c, now).state).toBe("MAINTENANCE");
    expect(serviceState(doc, c, now + 1000).state).toBe("OPERATIONAL");
    expect(serviceState(doc, { ...c, state: "OUTAGE" }, now).state).toBe("OUTAGE");
    doc.maintenance[0]!.cancelled = true;
    expect(serviceState(doc, c, now).state).toBe("OPERATIONAL");
  });
});
