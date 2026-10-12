import { describe, expect, it } from "vitest";
import { checkActiveMaintenance } from "@/lib/maintenance/check";

describe("Maintenance window suppression", () => {
  it("detects when an active maintenance window is ongoing", async () => {
    const now = new Date("2026-10-12T14:00:00Z");
    const mockPrisma = {
      statusPage: {
        findMany: async () => [
          {
            document: {
              maintenance: [
                {
                  id: "m-1",
                  title: "Database Upgrade Window",
                  summary: "Scheduled maintenance for PostgreSQL",
                  startsAt: "2026-10-12T13:30:00Z",
                  endsAt: "2026-10-12T15:00:00Z",
                  cancelled: false,
                  componentIds: ["comp-1"],
                },
              ],
            },
          },
        ],
      },
    };

    const status = await checkActiveMaintenance(mockPrisma as any, "org-1", "site-1", now);
    expect(status.inMaintenance).toBe(true);
    expect(status.title).toBe("Database Upgrade Window");
  });

  it("returns inMaintenance: false when window has ended or is cancelled", async () => {
    const now = new Date("2026-10-12T16:00:00Z");
    const mockPrisma = {
      statusPage: {
        findMany: async () => [
          {
            document: {
              maintenance: [
                {
                  id: "m-1",
                  title: "Past Window",
                  startsAt: "2026-10-12T13:30:00Z",
                  endsAt: "2026-10-12T15:00:00Z",
                  cancelled: false,
                  componentIds: ["comp-1"],
                },
                {
                  id: "m-2",
                  title: "Cancelled Window",
                  startsAt: "2026-10-12T15:30:00Z",
                  endsAt: "2026-10-12T17:00:00Z",
                  cancelled: true,
                  componentIds: ["comp-1"],
                },
              ],
            },
          },
        ],
      },
    };

    const status = await checkActiveMaintenance(mockPrisma as any, "org-1", "site-1", now);
    expect(status.inMaintenance).toBe(false);
  });
});

