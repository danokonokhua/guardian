import { describe, it, expect, vi, beforeEach } from "vitest";

const { pruneAllMock, pruneSystemMock } = vi.hoisted(() => ({
  pruneAllMock: vi.fn(),
  pruneSystemMock: vi.fn(),
}));

vi.mock("@/services/retention/pruner", () => ({
  pruneAllOrganizations: pruneAllMock,
  pruneSystemMaintenance: pruneSystemMock,
}));

import { enqueueRetentionPruneJob, registerRetentionPruneWorker } from "@/lib/jobs/retention-prune";
import { RETENTION_PRUNE_JOB, RETENTION_PRUNE_SINGLETON_KEY } from "@/lib/jobs/constants";

describe("Retention Prune Job & Worker", () => {
  let mockBoss: any;

  beforeEach(() => {
    pruneAllMock.mockReset().mockResolvedValue({
      totalOrganizations: 3,
      organizationsPruned: 2,
      organizationsSkipped: 1,
      totalMonitoringResultsPruned: 50,
      totalHealthScoresPruned: 5,
      totalResolvedIssuesPruned: 3,
      totalNotificationsPruned: 10,
      totalExternalDeliveriesPruned: 2,
      durationMs: 45,
    });
    pruneSystemMock.mockReset().mockResolvedValue({
      expiredSessionsPruned: 5,
      expiredResetTokensPruned: 2,
      staleLoginThrottlesPruned: 3,
      durationMs: 10,
    });

    mockBoss = {
      createQueue: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue("job-prune-123"),
      work: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("enqueues retention prune job with singleton throttle", async () => {
    const jobId = await enqueueRetentionPruneJob(mockBoss, { triggeredBy: "test_runner" });

    expect(jobId).toBe("job-prune-123");
    expect(mockBoss.createQueue).toHaveBeenCalledWith(
      RETENTION_PRUNE_JOB,
      expect.objectContaining({ retryLimit: 2 }),
    );
    expect(mockBoss.send).toHaveBeenCalledWith(
      RETENTION_PRUNE_JOB,
      { triggeredBy: "test_runner" },
      expect.objectContaining({
        singletonKey: RETENTION_PRUNE_SINGLETON_KEY,
        singletonSeconds: 86400,
      }),
    );
  });

  it("registers worker and executes pruning on worker dispatch", async () => {
    await registerRetentionPruneWorker(mockBoss);

    expect(mockBoss.createQueue).toHaveBeenCalledWith(RETENTION_PRUNE_JOB, expect.anything());
    expect(mockBoss.work).toHaveBeenCalledWith(RETENTION_PRUNE_JOB, expect.any(Function));

    // Simulate worker dispatch
    const handler = mockBoss.work.mock.calls[0][1];
    await handler([{ id: "job-1", data: { triggeredBy: "cron" } }]);

    expect(pruneAllMock).toHaveBeenCalledOnce();
    expect(pruneSystemMock).toHaveBeenCalledOnce();
  });
});
