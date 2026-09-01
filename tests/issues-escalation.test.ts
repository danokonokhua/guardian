import { beforeEach, describe, expect, it, vi } from "vitest";

const { transaction, readPolicy } = vi.hoisted(() => ({
  transaction: vi.fn(),
  readPolicy: vi.fn(),
}));
vi.mock("@/db/tenant", () => ({ withTenantTransaction: transaction }));
vi.mock("@/services/organizations/settings", () => ({
  readOrganizationSlaPolicy: readPolicy,
}));

import { enqueueSlaEscalations } from "@/services/issues/escalation";

const scope = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  role: "OWNER" as const,
};

describe("SLA escalation", () => {
  beforeEach(() => {
    readPolicy.mockResolvedValue({ acknowledgeMinutes: 5, resolveMinutes: 10 });
  });

  it("queues one notification per active owner/admin for breached issues", async () => {
    const issue = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      title: "Website is unreachable",
      severity: "HIGH",
      firstSeenAt: new Date(Date.now() - 20 * 60 * 1000),
      activities: [],
    };
    transaction.mockImplementationOnce((_scope: unknown, callback: (tx: unknown) => unknown) =>
      callback({
        issue: { findMany: vi.fn().mockResolvedValue([issue]) },
        organizationMember: {
          findMany: vi.fn().mockResolvedValue([{ userId: "u-owner" }, { userId: "u-admin" }]),
        },
      }),
    );
    const enqueue = vi.fn().mockResolvedValue("job-1");
    const result = await enqueueSlaEscalations(scope, enqueue);
    expect(result).toEqual({ checkedIssues: 1, breachedIssues: 1, notificationsQueued: 2 });
    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "IN_APP", issueId: issue.id }),
    );
  });

  it("does not notify when no issue exceeds policy", async () => {
    transaction.mockImplementationOnce((_scope: unknown, callback: (tx: unknown) => unknown) =>
      callback({
        issue: {
          findMany: vi
            .fn()
            .mockResolvedValue([
              { id: "i", title: "ok", severity: "LOW", firstSeenAt: new Date(), activities: [] },
            ]),
        },
        organizationMember: { findMany: vi.fn().mockResolvedValue([{ userId: "u" }]) },
      }),
    );
    const enqueue = vi.fn();
    const result = await enqueueSlaEscalations(scope, enqueue);
    expect(result.breachedIssues).toBe(0);
    expect(enqueue).not.toHaveBeenCalled();
  });
});
