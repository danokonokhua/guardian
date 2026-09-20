import { describe, expect, it, vi } from "vitest";

const lookupMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]),
);
vi.mock("node:dns/promises", () => ({ lookup: lookupMock }));
const { requestSafeMock, resolveSafeMock } = vi.hoisted(() => ({
  requestSafeMock: vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "" }),
  resolveSafeMock: vi.fn().mockResolvedValue({
    url: new URL("https://example.test"),
    hostname: "example.test",
    address: "93.184.216.34",
    family: 4,
  }),
}));
vi.mock("@/lib/security/outbound-url", () => ({
  pinnedLookup: vi.fn(),
  requestSafeOutbound: requestSafeMock,
  resolveSafeOutboundUrl: resolveSafeMock,
}));

const findMonitor = vi.fn();
const findWebsite = vi.fn();
const update = vi.fn();
const createResult = vi.fn();
const updateWebsite = vi.fn();
const findIssue = vi.fn().mockResolvedValue(null);
const upsertIssue = vi.fn().mockResolvedValue({ id: "issue-1" });
const updateIssues = vi.fn();
const updateIssue = vi.fn();
const issueActivityCreate = vi.fn();
const { captureHealthScoreSnapshot } = vi.hoisted(() => ({
  captureHealthScoreSnapshot: vi.fn().mockResolvedValue(undefined),
}));
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
        issue: {
          findUnique: findIssue,
          findFirst: findIssue,
          upsert: upsertIssue,
          updateMany: updateIssues,
          update: updateIssue,
        },
        issueActivity: { create: issueActivityCreate },
      }),
    monitor: { findUnique: findMonitor, update },
    website: { findUnique: findWebsite },
  }),
}));
vi.mock("@/services/health/repository", () => ({ captureHealthScoreSnapshot }));
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
    requestSafeMock.mockResolvedValue({ ok: true, status: 200, text: async () => "" });
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
    requestSafeMock.mockRejectedValue(new Error("offline"));
    await registerMonitorCheckWorker(boss);
    await (work.mock.calls[0]![1] as (jobs: unknown[]) => Promise<void>)([
      { data: { monitorId: "m1", websiteId: "w1", organizationId: "o1" } },
    ]);
    expect(update).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: expect.objectContaining({ consecutiveFailures: { increment: 1 } }),
    });
  });

  it("does not request a private monitoring destination", async () => {
    requestSafeMock.mockClear();
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
      normalizedUrl: "http://127.0.0.1:8080/admin",
      verifyStatus: "VERIFIED",
    });
    update.mockResolvedValue({});
    requestSafeMock.mockRejectedValueOnce(
      new Error("Website URL must resolve to a public address."),
    );
    await registerMonitorCheckWorker(boss);
    await (work.mock.calls[0]![1] as (jobs: unknown[]) => Promise<void>)([
      { data: { monitorId: "m1", websiteId: "w1", organizationId: "o1" } },
    ]);
    expect(requestSafeMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/admin",
      expect.objectContaining({ method: "HEAD", maxBodyBytes: 0 }),
    );
    expect(createResult).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "ERROR",
        errorMessage: "Website URL must resolve to a public address.",
      }),
    });
  });

  it("runs the LINKS adapter through the shared monitor worker", async () => {
    const work = vi.fn();
    const boss = { createQueue: vi.fn(), work } as never;
    findMonitor.mockResolvedValue({
      id: "m1",
      enabled: true,
      organizationId: "o1",
      websiteId: "w1",
      frequencyMinutes: 5,
      config: { maxLinks: 10 },
    });
    findWebsite.mockResolvedValue({
      id: "w1",
      normalizedUrl: "https://example.test",
      verifyStatus: "VERIFIED",
    });
    update.mockResolvedValue({});
    requestSafeMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<a href="/pricing">Pricing</a>',
      })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => "" });
    await registerMonitorCheckWorker(boss);
    await (work.mock.calls[0]![1] as (jobs: unknown[]) => Promise<void>)([
      { data: { monitorId: "m1", websiteId: "w1", organizationId: "o1", type: "LINKS" } },
    ]);
    expect(createResult).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "UP",
        details: expect.objectContaining({ checkType: "LINKS", scannedLinks: 1 }),
      }),
    });
  });
});
