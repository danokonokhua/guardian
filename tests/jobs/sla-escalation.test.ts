import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, runEscalations } = vi.hoisted(() => ({
  findMany: vi.fn(),
  runEscalations: vi.fn(),
}));
vi.mock("@/db/client", () => ({ getPrisma: () => ({ organization: { findMany } }) }));
vi.mock("@/services/issues/escalation", () => ({ enqueueSlaEscalations: runEscalations }));
vi.mock("@/lib/notifications", () => ({ enqueueNotification: vi.fn() }));

import {
  enqueueSlaEscalation,
  registerSlaEscalationWorker,
  scheduleDueSlaEscalations,
} from "@/lib/jobs/sla-escalation";

describe("SLA escalation jobs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("enqueues one retryable singleton job per organization", async () => {
    const boss = { createQueue: vi.fn(), send: vi.fn().mockResolvedValue("job-1") } as never;
    await expect(enqueueSlaEscalation("org-1", boss)).resolves.toBe("job-1");
    expect((boss as { send: ReturnType<typeof vi.fn> }).send).toHaveBeenCalledWith(
      "issue.sla_escalation",
      { organizationId: "org-1" },
      expect.objectContaining({ singletonKey: "sla-escalation:org-1", retryLimit: 2 }),
    );
  });

  it("schedules active organizations and ignores duplicate sends", async () => {
    findMany.mockResolvedValue([{ id: "org-1" }, { id: "org-2" }]);
    const send = vi.fn().mockResolvedValueOnce("job-1").mockResolvedValueOnce(null);
    const boss = { createQueue: vi.fn(), send } as never;
    await expect(scheduleDueSlaEscalations(boss)).resolves.toBe(1);
    expect(send).toHaveBeenCalledTimes(2);
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
  });
});
