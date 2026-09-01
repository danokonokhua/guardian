import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, transaction } = vi.hoisted(() => ({ findMany: vi.fn(), transaction: vi.fn() }));
vi.mock("@/db/tenant", () => ({
  withTenantTransaction: transaction,
}));

import { readIssueAnalytics } from "@/services/issues/analytics";

const scope = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  role: "OWNER" as const,
};

describe("issue analytics", () => {
  beforeEach(() => {
    transaction.mockImplementation((_scope: unknown, callback: (tx: unknown) => unknown) =>
      callback({
        issue: { findMany },
        organization: { findUnique: vi.fn().mockResolvedValue({ settings: {} }) },
      }),
    );
  });

  it("calculates mean acknowledge/resolve times and SLA breaches", async () => {
    const now = Date.now();
    const firstSeenAt = new Date(now - 3 * 60 * 60 * 1000);
    findMany.mockResolvedValue([
      {
        firstSeenAt,
        status: "RESOLVED",
        activities: [
          { action: "ACKNOWLEDGED", createdAt: new Date(now - 2.5 * 60 * 60 * 1000) },
          { action: "RESOLVED", createdAt: new Date(now - 1 * 60 * 60 * 1000) },
        ],
      },
    ]);
    const result = await readIssueAnalytics(scope);
    expect(result.meanTimeToAcknowledgeMinutes).toBe(30);
    expect(result.meanTimeToResolveMinutes).toBe(120);
    expect(result.sampleSizes).toEqual({ acknowledged: 1, resolved: 1 });
    expect(result.sla.acknowledgeBreaches).toBe(0);
    expect(result.sla.resolveBreaches).toBe(0);
    expect(result.volumeTrend).toHaveLength(14);
  });

  it("counts unresolved issues that exceed the SLA windows", async () => {
    findMany.mockResolvedValue([
      {
        firstSeenAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        status: "OPEN",
        activities: [],
      },
    ]);
    const result = await readIssueAnalytics(scope);
    expect(result.sla.acknowledgeBreaches).toBe(1);
    expect(result.sla.resolveBreaches).toBe(1);
    expect(result.sla.activeBreaches).toBe(2);
  });

  it("uses an organization-specific SLA policy", async () => {
    const organizationFindUnique = vi.fn().mockResolvedValue({
      settings: { sla: { acknowledgeMinutes: 5, resolveMinutes: 10 } },
    });
    transaction.mockImplementationOnce((_scope: unknown, callback: (tx: unknown) => unknown) =>
      callback({
        issue: { findMany },
        organization: { findUnique: organizationFindUnique },
      } as never),
    );
    findMany.mockResolvedValue([
      { firstSeenAt: new Date(Date.now() - 20 * 60 * 1000), status: "OPEN", activities: [] },
    ]);
    const result = await readIssueAnalytics(scope);
    expect(result.policy).toEqual({ acknowledgeMinutes: 5, resolveMinutes: 10 });
    expect(result.sla.acknowledgeBreaches).toBe(1);
    expect(result.sla.resolveBreaches).toBe(1);
  });
});
