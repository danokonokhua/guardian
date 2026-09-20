import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runPerformanceCheck: vi.fn(),
  recordFindingScoped: vi.fn(),
  resolveFindingScoped: vi.fn(),
  issueFingerprint: vi.fn(() => "performance-fingerprint"),
  findMonitor: vi.fn(),
  findWebsite: vi.fn(),
  createResult: vi.fn(),
  updateMonitor: vi.fn(),
  updateWebsite: vi.fn(),
  captureHealthScoreSnapshot: vi.fn().mockResolvedValue(undefined),
}));

const prisma = {};
const transaction = {
  monitor: { findFirst: mocks.findMonitor, update: mocks.updateMonitor },
  website: { findFirst: mocks.findWebsite, update: mocks.updateWebsite },
  monitoringResult: { create: mocks.createResult },
};

vi.mock("@/db/client", () => ({ getPrisma: () => prisma }));
vi.mock("@/db/tenant", () => ({
  withGucContext: async (_scope: unknown, callback: (tx: typeof transaction) => Promise<unknown>) =>
    callback(transaction),
}));
vi.mock("@/lib/jobs/performance-check", () => ({
  runPerformanceCheck: mocks.runPerformanceCheck,
}));
vi.mock("@/lib/issue-engine", () => ({
  recordFindingScoped: mocks.recordFindingScoped,
  resolveFindingScoped: mocks.resolveFindingScoped,
  issueFingerprint: mocks.issueFingerprint,
}));
vi.mock("@/services/health/repository", () => ({
  captureHealthScoreSnapshot: mocks.captureHealthScoreSnapshot,
}));

import { registerMonitorCheckWorker } from "@/lib/jobs/monitor-check";

const targetMonitor = {
  id: "monitor-1",
  enabled: true,
  type: "PERFORMANCE",
  organizationId: "organization-1",
  websiteId: "website-1",
  frequencyMinutes: 15,
  config: { maxResponseTimeMs: 1_500 },
};
const targetWebsite = {
  id: "website-1",
  normalizedUrl: "https://example.com/",
  verifyStatus: "VERIFIED",
};

async function runPerformanceWorker(): Promise<void> {
  const work = vi.fn();
  const boss = { createQueue: vi.fn(), work } as never;
  await registerMonitorCheckWorker(boss);
  const handler = work.mock.calls[0]![1] as (jobs: unknown[]) => Promise<void>;
  await handler([
    {
      data: {
        monitorId: "monitor-1",
        websiteId: "website-1",
        organizationId: "organization-1",
        type: "PERFORMANCE",
      },
    },
  ]);
}

describe("PERFORMANCE monitor worker integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMonitor.mockResolvedValue(targetMonitor);
    mocks.findWebsite.mockResolvedValue(targetWebsite);
    mocks.createResult.mockResolvedValue({});
    mocks.updateMonitor.mockResolvedValue({});
    mocks.updateWebsite.mockResolvedValue({});
  });

  it("routes performance jobs with monitor configuration and persists evidence", async () => {
    mocks.runPerformanceCheck.mockResolvedValue({
      status: "DOWN",
      healthy: false,
      responseTimeMs: 1_501,
      httpStatusCode: 200,
      details: {
        checkType: "PERFORMANCE",
        metric: "server_response",
        elapsedMs: 1_501,
        thresholdMs: 1_500,
        failureClass: "threshold_exceeded",
      },
      finding: {
        ruleId: "monitor.performance",
        severity: "MEDIUM",
        title: "Website server response is above threshold",
        summary: "The homepage server response took 1501 ms.",
      },
    });

    await runPerformanceWorker();

    expect(mocks.runPerformanceCheck).toHaveBeenCalledWith("https://example.com/", {
      maxResponseTimeMs: 1_500,
    });
    expect(mocks.createResult).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "organization-1",
        monitorId: "monitor-1",
        websiteId: "website-1",
        status: "DOWN",
        responseTimeMs: 1_501,
        details: expect.objectContaining({
          checkType: "PERFORMANCE",
          failureClass: "threshold_exceeded",
        }),
      }),
    });
    expect(mocks.recordFindingScoped).toHaveBeenCalledWith(
      { organizationId: "organization-1" },
      expect.objectContaining({ ruleId: "monitor.performance", severity: "MEDIUM" }),
      prisma,
    );
  });

  it("resolves a recovered performance finding", async () => {
    mocks.runPerformanceCheck.mockResolvedValue({
      status: "UP",
      healthy: true,
      responseTimeMs: 250,
      httpStatusCode: 200,
      details: {
        checkType: "PERFORMANCE",
        metric: "server_response",
        elapsedMs: 250,
        thresholdMs: 1_500,
        failureClass: "none",
      },
      finding: {
        ruleId: "monitor.performance",
        severity: "MEDIUM",
        title: "Website server response is within threshold",
        summary: "The homepage server response completed within the threshold.",
      },
    });

    await runPerformanceWorker();

    expect(mocks.updateMonitor).toHaveBeenCalledWith({
      where: { id: "monitor-1" },
      data: expect.objectContaining({ consecutiveFailures: 0 }),
    });
    expect(mocks.resolveFindingScoped).toHaveBeenCalledWith(
      { organizationId: "organization-1" },
      "performance-fingerprint",
      prisma,
    );
    expect(mocks.recordFindingScoped).not.toHaveBeenCalled();
  });
});
