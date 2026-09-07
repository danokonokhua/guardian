import { beforeEach, describe, expect, it, vi } from "vitest";

const { listDue, claim, release, deleteDispatch, runEscalations } = vi.hoisted(() => ({
  listDue: vi.fn(),
  claim: vi.fn(),
  release: vi.fn(),
  deleteDispatch: vi.fn(),
  runEscalations: vi.fn(),
}));
vi.mock("@/db/client", () => ({ getPrisma: () => ({}) }));
vi.mock("@/lib/jobs/dispatch", () => ({
  listDueSlaDispatches: listDue,
  claimSlaDispatch: claim,
  releaseSlaDispatch: release,
  deleteSlaDispatch: deleteDispatch,
}));
vi.mock("@/services/issues/escalation", () => ({ enqueueSlaEscalations: runEscalations }));
vi.mock("@/lib/notifications", () => ({ enqueueNotification: vi.fn() }));

import {
  enqueueSlaEscalation,
  registerSlaEscalationWorker,
  scheduleDueSlaEscalations,
} from "@/lib/jobs/sla-escalation";

describe("SLA escalation jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listDue.mockResolvedValue([]);
    claim.mockResolvedValue(null);
    release.mockResolvedValue(undefined);
    deleteDispatch.mockResolvedValue(undefined);
  });

  it("enqueues one retryable singleton job per organization", async () => {
    const boss = { createQueue: vi.fn(), send: vi.fn().mockResolvedValue("job-1") } as never;
    await expect(enqueueSlaEscalation("org-1", boss)).resolves.toBe("job-1");
    expect((boss as { send: ReturnType<typeof vi.fn> }).send).toHaveBeenCalledWith(
      "issue.sla_escalation",
      { organizationId: "org-1" },
      expect.objectContaining({ singletonKey: "sla-escalation:org-1", retryLimit: 2 }),
    );
  });

  it("claims active dispatch rows and ignores duplicate sends", async () => {
    listDue.mockResolvedValue([{ organizationId: "org-1" }, { organizationId: "org-2" }]);
    claim.mockImplementation(async (_client: unknown, organizationId: string) => ({
      organizationId,
      frequencyMinutes: 5,
      nextRunAt: new Date(),
    }));
    const send = vi.fn().mockResolvedValueOnce("job-1").mockResolvedValueOnce(null);
    const boss = { createQueue: vi.fn(), send } as never;
    await expect(scheduleDueSlaEscalations(boss)).resolves.toBe(1);
    expect(send).toHaveBeenCalledTimes(2);
    expect(claim).toHaveBeenCalledTimes(2);
  });

  it("releases a claim when the queue submission fails", async () => {
    listDue.mockResolvedValue([{ organizationId: "org-1" }]);
    claim.mockResolvedValue({
      organizationId: "org-1",
      frequencyMinutes: 5,
      nextRunAt: new Date(),
    });
    const error = new Error("queue unavailable");
    const boss = { createQueue: vi.fn(), send: vi.fn().mockRejectedValue(error) } as never;
    await expect(scheduleDueSlaEscalations(boss)).rejects.toBe(error);
    expect(release).toHaveBeenCalledWith(expect.anything(), "org-1");
  });

  it("runs tenant-scoped escalation and queues its notifications", async () => {
    const work = vi.fn();
    const boss = { createQueue: vi.fn(), work, send: vi.fn() } as never;
    runEscalations.mockResolvedValue({
      checkedIssues: 2,
      breachedIssues: 1,
      notificationsQueued: 1,
    });
    await registerSlaEscalationWorker(boss);
    await (work.mock.calls[0]![1] as (jobs: unknown[]) => Promise<void>)([
      { data: { organizationId: "org-1" } },
    ]);
    expect(runEscalations).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-1", role: "OWNER" }),
      expect.any(Function),
    );
    expect(deleteDispatch).not.toHaveBeenCalled();
  });

  it("removes the dispatch row after an empty tenant queue", async () => {
    const work = vi.fn();
    const boss = { createQueue: vi.fn(), work, send: vi.fn() } as never;
    runEscalations.mockResolvedValue({
      checkedIssues: 0,
      breachedIssues: 0,
      notificationsQueued: 0,
    });
    await registerSlaEscalationWorker(boss);
    await (work.mock.calls[0]![1] as (jobs: unknown[]) => Promise<void>)([
      { data: { organizationId: "org-1" } },
    ]);
    expect(deleteDispatch).toHaveBeenCalledWith(expect.anything(), "org-1");
  });
});
