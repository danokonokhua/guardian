import { describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const update = vi.fn();
vi.mock("@/db/client", () => ({ getPrisma: () => ({ monitor: { findMany, update } }) }));

import { scheduleDueMonitors } from "@/lib/jobs/scheduler";

const bossMock = {
  createQueue: vi.fn().mockResolvedValue(undefined),
  send: vi.fn().mockResolvedValue("job-1"),
};
const boss = bossMock as never;

describe("monitor scheduler", () => {
  it("enqueues due monitors and advances nextRunAt", async () => {
    findMany.mockResolvedValueOnce([
      {
        id: "m1",
        organizationId: "o1",
        websiteId: "w1",
        type: "UPTIME",
        frequencyMinutes: 5,
      },
    ]);
    update.mockResolvedValue({});
    expect(await scheduleDueMonitors(boss)).toBe(1);
    expect(bossMock.createQueue).toHaveBeenCalledWith("monitor.check", expect.any(Object));
    expect(bossMock.send).toHaveBeenCalledWith(
      "monitor.check",
      { organizationId: "o1", websiteId: "w1", monitorId: "m1", type: "UPTIME" },
      expect.objectContaining({ singletonKey: "monitor:m1" }),
    );
    expect(update).toHaveBeenCalledOnce();
  });

  it("returns zero when no monitors are due", async () => {
    findMany.mockResolvedValueOnce([]);
    expect(await scheduleDueMonitors(boss)).toBe(0);
  });
});
