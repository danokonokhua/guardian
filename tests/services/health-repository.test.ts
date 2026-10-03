import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMonitors: vi.fn(),
  findIssues: vi.fn(),
  createScore: vi.fn(),
  findGoogleIntegration: vi.fn(),
}));

const transaction = {
  monitor: { findMany: mocks.findMonitors },
  issue: { findMany: mocks.findIssues },
  healthScore: { create: mocks.createScore },
  googleIntegration: { findMany: mocks.findGoogleIntegration },
};

vi.mock("@/db/client", () => ({ getPrisma: vi.fn() }));
vi.mock("@/db/tenant", () => ({
  withGucContext: async (_guc: unknown, callback: (tx: typeof transaction) => Promise<unknown>) =>
    callback(transaction),
  withTenantTransaction: vi.fn(),
}));

import { captureHealthScoreSnapshot } from "@/services/health/repository";

describe("health score persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMonitors.mockResolvedValue([
      {
        id: "monitor-uptime",
        type: "UPTIME",
        results: [
          { id: "result-uptime", status: "UP", checkedAt: new Date("2026-09-11T12:00:00Z") },
        ],
      },
      {
        id: "monitor-form",
        type: "FORM",
        results: [
          { id: "result-form", status: "DOWN", checkedAt: new Date("2026-09-11T12:00:00Z") },
        ],
      },
    ]);
    mocks.findIssues.mockResolvedValue([
      {
        id: "issue-form",
        ruleId: "monitor.form",
        severity: "CRITICAL",
        status: "OPEN",
        title: "Lead form unavailable",
        summary: "The named form was not found.",
        businessImpact: "Leads may be lost.",
        lastSeenAt: new Date("2026-09-11T12:00:00Z"),
      },
    ]);
    mocks.findGoogleIntegration.mockResolvedValue([]);
    mocks.createScore.mockResolvedValue({ id: "score-1" });
  });

  it("calculates and persists one tenant-scoped snapshot with all six components", async () => {
    const score = await captureHealthScoreSnapshot({ organizationId: "org-a" });

    expect(score.state).toBe("PARTIAL");
    expect(score.coverageWeight).toBe(50);
    expect(score.score).toBe(50);
    expect(mocks.createScore).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-a",
        score: 50,
        state: "PARTIAL",
        coverageWeight: 50,
        sourceVersion: "v1",
        components: {
          create: expect.arrayContaining([
            expect.objectContaining({
              organization: { connect: { id: "org-a" } },
              category: "WEBSITE",
              score: 100,
              state: "MEASURED",
            }),
            expect.objectContaining({
              organization: { connect: { id: "org-a" } },
              category: "LEAD_GENERATION",
              score: 0,
              state: "MEASURED",
              evidence: expect.objectContaining({ issueIds: ["issue-form"] }),
            }),
            expect.objectContaining({ category: "REPUTATION", score: null, state: "PENDING" }),
          ]),
        },
      }),
    });
    const createPayload = mocks.createScore.mock.calls[0]![0].data;
    expect(createPayload.components.create).toHaveLength(6);
    expect(
      createPayload.components.create.every(
        (component: { organization: unknown }) => component.organization,
      ),
    ).toBe(true);
  });

  it("includes Google Business Profile reputation data in the persisted snapshot", async () => {
    mocks.findGoogleIntegration.mockResolvedValue([
      {
        id: "gbp-1",
        status: "CONNECTED",
        lastSyncAt: new Date("2026-09-11T12:00:00Z"),
        syncSummary: {
          averageRating: 4.8,
          totalReviewCount: 24,
          unansweredReviewsCount: 0,
          ratingHealth: "HEALTHY",
        },
      },
    ]);

    const score = await captureHealthScoreSnapshot({ organizationId: "org-a" });

    // 50 (website 25 + lead 25) + 10 (reputation) = 60
    expect(score.coverageWeight).toBe(60);
    expect(mocks.createScore).toHaveBeenCalledWith({
      data: expect.objectContaining({
        components: {
          create: expect.arrayContaining([
            expect.objectContaining({
              category: "REPUTATION",
              score: 96,
              state: "MEASURED",
            }),
          ]),
        },
      }),
    });
  });
});
