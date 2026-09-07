import { beforeEach, describe, expect, it, vi } from "vitest";

const { listDue, claim, release } = vi.hoisted(() => ({
  listDue: vi.fn(),
  claim: vi.fn(),
  release: vi.fn(),
}));

vi.mock("@/db/client", () => ({ getPrisma: () => ({}) }));
vi.mock("@/lib/jobs/dispatch", () => ({
  listDueMonitorDispatches: listDue,
  claimMonitorDispatch: claim,
  releaseMonitorDispatch: release,
}));

import { scheduleDueMonitors } from "@/lib/jobs/scheduler";

describe("monitor scheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listDue.mockResolvedValue([]);
    claim.mockResolvedValue(null);
    release.mockResolvedValue(undefined);
  });

  it("claims and enqueues due dispatch rows without reading tenant tables", async () => {
    listDue.mockResolvedValueOnce([
      {
        monitorId: "m1",
        organizationId: "o1",
        websiteId: "w1",
        type: "UPTIME",
        enabled: true,
        frequencyMinutes: 5,
        nextRunAt: new Date(),
      },
    ]);
    claim.mockResolvedValueOnce({
      monitorId: "m1",
      organizationId: "o1",
      websiteId: "w1",
      type: "UPTIME",
      enabled: true,
      frequencyMinutes: 5,
      nextRunAt: new Date(),
    });
    const send = vi.fn().mockResolvedValue("job-1");
    const boss = {
      createQueue: vi.fn().mockResolvedValue(undefined),
      send,
    } as never;

    expect(await scheduleDueMonitors(boss)).toBe(1);
    expect(listDue).toHaveBeenCalledOnce();
    expect(claim).toHaveBeenCalledWith(expect.anything(), "m1");
    expect(send).toHaveBeenCalledWith(
      "monitor.check",
      { organizationId: "o1", websiteId: "w1", monitorId: "m1", type: "UPTIME" },
      expect.objectContaining({ singletonKey: "monitor:m1" }),
    );
  });

  it("releases the claim when queue submission fails", async () => {
    listDue.mockResolvedValueOnce([{ monitorId: "m1" }]);
    claim.mockResolvedValueOnce({
      monitorId: "m1",
      organizationId: "o1",
      websiteId: "w1",
      type: "UPTIME",
      frequencyMinutes: 5,
    });
    const error = new Error("queue unavailable");
    const send = vi.fn().mockRejectedValue(error);
    const boss = {
      createQueue: vi.fn().mockResolvedValue(undefined),
      send,
    } as never;

    await expect(scheduleDueMonitors(boss)).rejects.toBe(error);
    expect(release).toHaveBeenCalledWith(expect.anything(), "m1");
  });

  it("returns zero when no dispatch rows are due", async () => {
    const send = vi.fn();
    const boss = { createQueue: vi.fn().mockResolvedValue(undefined), send } as never;
    expect(await scheduleDueMonitors(boss)).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });
});
