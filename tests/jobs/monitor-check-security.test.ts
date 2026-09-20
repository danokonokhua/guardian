import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runSecurityCheck: vi.fn(),
  recordFindingScoped: vi.fn(),
  resolveFindingScoped: vi.fn(),
  issueFingerprint: vi.fn(() => "security-fingerprint"),
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
vi.mock("@/lib/jobs/security-check", () => ({ runSecurityCheck: mocks.runSecurityCheck }));
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
  type: "SECURITY",
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

async function runSecurityWorker(): Promise<void> {
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
        type: "SECURITY",
      },
    },
  ]);
}

describe("SECURITY monitor worker integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMonitor.mockResolvedValue(targetMonitor);
    mocks.findWebsite.mockResolvedValue(targetWebsite);
    mocks.createResult.mockResolvedValue({});
    mocks.updateMonitor.mockResolvedValue({});
    mocks.updateWebsite.mockResolvedValue({});
  });

  it("routes security jobs and persists bounded evidence", async () => {
    mocks.runSecurityCheck.mockResolvedValue({
      status: "DOWN",
      healthy: false,
      responseTimeMs: 31,
      httpStatusCode: 200,
      details: { checkType: "SECURITY", failureCount: 1, failedChecks: "csp" },
      finding: {
        ruleId: "monitor.security",
        severity: "MEDIUM",
        title: "Basic security checks failed",
        summary: "The homepage does not send an enforced Content-Security-Policy header.",
      },
    });

    await runSecurityWorker();

    expect(mocks.runSecurityCheck).toHaveBeenCalledWith("https://example.com/");
    expect(mocks.createResult).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "organization-1",
        monitorId: "monitor-1",
        websiteId: "website-1",
        status: "DOWN",
        responseTimeMs: 31,
        details: expect.objectContaining({ checkType: "SECURITY", failedChecks: "csp" }),
      }),
    });
    expect(mocks.updateMonitor).toHaveBeenCalledWith({
      where: { id: "monitor-1" },
      data: expect.objectContaining({ consecutiveFailures: { increment: 1 } }),
    });
    expect(mocks.recordFindingScoped).toHaveBeenCalledWith(
      { organizationId: "organization-1" },
      expect.objectContaining({ ruleId: "monitor.security", severity: "MEDIUM" }),
      prisma,
    );
  });

  it("resolves a recovered security finding", async () => {
    mocks.runSecurityCheck.mockResolvedValue({
      status: "UP",
      healthy: true,
      responseTimeMs: 20,
      httpStatusCode: 200,
      details: { checkType: "SECURITY", failureCount: 0, failedChecks: "none" },
      finding: {
        ruleId: "monitor.security",
        severity: "MEDIUM",
        title: "Basic security checks passed",
        summary: "The homepage passed Guardian's bounded basic security checks.",
      },
    });

    await runSecurityWorker();

    expect(mocks.updateMonitor).toHaveBeenCalledWith({
      where: { id: "monitor-1" },
      data: expect.objectContaining({ consecutiveFailures: 0 }),
    });
    expect(mocks.resolveFindingScoped).toHaveBeenCalledWith(
      { organizationId: "organization-1" },
      "security-fingerprint",
      prisma,
    );
    expect(mocks.recordFindingScoped).not.toHaveBeenCalled();
  });
});
