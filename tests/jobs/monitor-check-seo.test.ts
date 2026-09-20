import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runSeoCheck: vi.fn(),
  recordFindingScoped: vi.fn(),
  resolveFindingScoped: vi.fn(),
  issueFingerprint: vi.fn(() => "seo-fingerprint"),
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
vi.mock("@/lib/jobs/seo-check", () => ({ runSeoCheck: mocks.runSeoCheck }));
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
  organizationId: "organization-1",
  websiteId: "website-1",
  frequencyMinutes: 15,
  config: {},
};
const targetWebsite = {
  id: "website-1",
  normalizedUrl: "https://example.com/",
  verifyStatus: "VERIFIED",
};

async function runSeoWorker(): Promise<void> {
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
        type: "SEO",
      },
    },
  ]);
}

describe("SEO monitor worker integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMonitor.mockResolvedValue(targetMonitor);
    mocks.findWebsite.mockResolvedValue(targetWebsite);
    mocks.createResult.mockResolvedValue({});
    mocks.updateMonitor.mockResolvedValue({});
    mocks.updateWebsite.mockResolvedValue({});
  });

  it("routes SEO jobs through the SEO adapter and persists bounded evidence", async () => {
    mocks.runSeoCheck.mockResolvedValue({
      status: "DOWN",
      healthy: false,
      responseTimeMs: 25,
      httpStatusCode: 200,
      details: { checkType: "SEO", failureCount: 1, failedChecks: "title" },
      finding: {
        ruleId: "monitor.seo",
        severity: "MEDIUM",
        title: "Basic SEO checks failed",
        summary: "The page has no title.",
      },
    });

    await runSeoWorker();

    expect(mocks.runSeoCheck).toHaveBeenCalledOnce();
    expect(mocks.runSeoCheck).toHaveBeenCalledWith("https://example.com/");
    expect(mocks.createResult).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "organization-1",
        monitorId: "monitor-1",
        websiteId: "website-1",
        status: "DOWN",
        responseTimeMs: 25,
        httpStatusCode: 200,
        details: expect.objectContaining({ checkType: "SEO", failedChecks: "title" }),
      }),
    });
    expect(mocks.updateMonitor).toHaveBeenCalledWith({
      where: { id: "monitor-1" },
      data: expect.objectContaining({ consecutiveFailures: { increment: 1 } }),
    });
    expect(mocks.recordFindingScoped).toHaveBeenCalledWith(
      { organizationId: "organization-1" },
      expect.objectContaining({
        ruleId: "monitor.seo",
        severity: "MEDIUM",
        technicalEvidence: expect.objectContaining({
          checkType: "SEO",
          failedChecks: "title",
          httpStatusCode: 200,
        }),
      }),
      prisma,
    );
    expect(mocks.resolveFindingScoped).not.toHaveBeenCalled();
  });

  it("resolves the aggregate SEO finding after a complete healthy scan", async () => {
    mocks.runSeoCheck.mockResolvedValue({
      status: "UP",
      healthy: true,
      responseTimeMs: 20,
      httpStatusCode: 200,
      details: { checkType: "SEO", failureCount: 0, failedChecks: "none" },
      finding: {
        ruleId: "monitor.seo",
        severity: "MEDIUM",
        title: "Basic SEO checks failed",
        summary: "The monitored page passed the basic SEO checks.",
      },
    });

    await runSeoWorker();

    expect(mocks.updateMonitor).toHaveBeenCalledWith({
      where: { id: "monitor-1" },
      data: expect.objectContaining({ consecutiveFailures: 0 }),
    });
    expect(mocks.issueFingerprint).toHaveBeenCalledWith(
      expect.objectContaining({ ruleId: "monitor.seo", monitorId: "monitor-1" }),
    );
    expect(mocks.resolveFindingScoped).toHaveBeenCalledWith(
      { organizationId: "organization-1" },
      "seo-fingerprint",
      prisma,
    );
    expect(mocks.recordFindingScoped).not.toHaveBeenCalled();
  });
});
