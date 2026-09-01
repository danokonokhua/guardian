import { describe, expect, it, vi } from "vitest";

const findMonitor = vi.fn();
const findWebsite = vi.fn();
const update = vi.fn();
const createResult = vi.fn();
const updateWebsite = vi.fn();
const findIssue = vi.fn().mockResolvedValue(null);
const upsertIssue = vi.fn().mockResolvedValue({ id: "issue-1" });
const updateIssues = vi.fn();
vi.mock("@/db/client", () => ({
  getPrisma: () => ({
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        $executeRaw: vi.fn(),
        monitor: {
          findFirst: findMonitor,
          update,
        },
        website: { findFirst: findWebsite, update: updateWebsite },
        monitoringResult: { create: createResult },
        issue: { findUnique: findIssue, upsert: upsertIssue, updateMany: updateIssues },
      }),
    monitor: { findUnique: findMonitor, update },
    website: { findUnique: findWebsite },
  }),
}));
import { registerMonitorCheckWorker } from "@/lib/jobs/monitor-check";

describe("monitor.check worker", () => {
  it("records a successful uptime check", async () => {
    const work = vi.fn();
    const boss = { createQueue: vi.fn(), work } as never;
    findMonitor.mockResolvedValue({
      id: "m1",
      enabled: true,
      organizationId: "o1",
      websiteId: "w1",
      consecutiveFailures: 2,
    });
    findWebsite.mockResolvedValue({
      id: "w1",
      normalizedUrl: "https://example.test",
      verifyStatus: "VERIFIED",
    });
    update.mockResolvedValue({});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await registerMonitorCheckWorker(boss);
    const handler = work.mock.calls[0]![1] as (jobs: unknown[]) => Promise<void>;
    await handler([{ data: { monitorId: "m1", websiteId: "w1", organizationId: "o1" } }]);
    expect(update).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: expect.objectContaining({ consecutiveFailures: 0 }),
    });
  });

  it("increments failures when the check fails", async () => {
    const work = vi.fn();
    const boss = { createQueue: vi.fn(), work } as never;
    findMonitor.mockResolvedValue({
      id: "m1",
      enabled: true,
      organizationId: "o1",
      websiteId: "w1",
      consecutiveFailures: 0,
    });
    findWebsite.mockResolvedValue({
      id: "w1",
      normalizedUrl: "https://example.test",
      verifyStatus: "VERIFIED",
    });
    update.mockResolvedValue({});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await registerMonitorCheckWorker(boss);
    await (work.mock.calls[0]![1] as (jobs: unknown[]) => Promise<void>)([
      { data: { monitorId: "m1", websiteId: "w1", organizationId: "o1" } },
    ]);
    expect(update).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: expect.objectContaining({ consecutiveFailures: { increment: 1 } }),
    });
  });
});
