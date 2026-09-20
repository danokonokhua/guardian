import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runFormCheck: vi.fn(),
  recordFindingScoped: vi.fn(),
  resolveFindingScoped: vi.fn(),
  issueFingerprint: vi.fn(() => "form-fingerprint"),
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
vi.mock("@/lib/jobs/form-check", () => ({ runFormCheck: mocks.runFormCheck }));
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
  type: "FORM",
  organizationId: "organization-1",
  websiteId: "website-1",
  frequencyMinutes: 15,
  config: { formId: "contact-form", pagePath: "/contact" },
};
const targetWebsite = {
  id: "website-1",
  normalizedUrl: "https://example.com/",
  verifyStatus: "VERIFIED",
};

async function runFormWorker(): Promise<void> {
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
        type: "FORM",
      },
    },
  ]);
}

describe("FORM monitor worker integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMonitor.mockResolvedValue(targetMonitor);
    mocks.findWebsite.mockResolvedValue(targetWebsite);
    mocks.createResult.mockResolvedValue({});
    mocks.updateMonitor.mockResolvedValue({});
    mocks.updateWebsite.mockResolvedValue({});
  });

  it("routes the form adapter and persists business-impact evidence", async () => {
    mocks.runFormCheck.mockResolvedValue({
      status: "DOWN",
      healthy: false,
      responseTimeMs: 81,
      httpStatusCode: 200,
      details: {
        checkType: "FORM",
        probeMode: "PRESENCE",
        failureClass: "form_not_found",
        pagePath: "/contact",
      },
      finding: {
        ruleId: "monitor.form",
        severity: "CRITICAL",
        title: "Critical lead form check failed",
        summary: "The form is missing.",
        businessImpact: "Leads may be lost.",
        recommendedAction: "Restore the form.",
      },
    });

    await runFormWorker();

    expect(mocks.runFormCheck).toHaveBeenCalledWith("https://example.com/", targetMonitor.config);
    expect(mocks.createResult).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "DOWN",
        responseTimeMs: 81,
        details: expect.objectContaining({ failureClass: "form_not_found" }),
      }),
    });
    expect(mocks.recordFindingScoped).toHaveBeenCalledWith(
      { organizationId: "organization-1" },
      expect.objectContaining({
        ruleId: "monitor.form",
        severity: "CRITICAL",
        businessImpact: "Leads may be lost.",
        recommendedAction: "Restore the form.",
      }),
      prisma,
    );
  });

  it("resolves a recovered form finding", async () => {
    mocks.runFormCheck.mockResolvedValue({
      status: "UP",
      healthy: true,
      responseTimeMs: 75,
      httpStatusCode: 200,
      details: {
        checkType: "FORM",
        probeMode: "PRESENCE",
        failureClass: "none",
        formFound: 1,
      },
      finding: {
        ruleId: "monitor.form",
        severity: "CRITICAL",
        title: "Critical lead form presence check passed",
        summary: "The form is present.",
      },
    });

    await runFormWorker();

    expect(mocks.resolveFindingScoped).toHaveBeenCalledWith(
      { organizationId: "organization-1" },
      "form-fingerprint",
      prisma,
    );
    expect(mocks.recordFindingScoped).not.toHaveBeenCalled();
  });
});
