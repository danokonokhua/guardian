import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrganizationContext } from "@/lib/auth/context";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  readPolicy: vi.fn(),
  updatePolicy: vi.fn(),
  readAnalytics: vi.fn(),
  escalate: vi.fn(),
}));
vi.mock("@/lib/auth/context", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("@/services/organizations/settings", () => ({
  readOrganizationSlaPolicy: mocks.readPolicy,
  updateOrganizationSlaPolicy: mocks.updatePolicy,
  slaPolicySchema: {
    parse: (value: unknown) => value,
    safeParse: (value: unknown) => ({ success: true, data: value }),
  },
}));
vi.mock("@/services/issues/analytics", () => ({ readIssueAnalytics: mocks.readAnalytics }));
vi.mock("@/services/issues/escalation", () => ({ enqueueSlaEscalations: mocks.escalate }));

import {
  GET as slaGET,
  PATCH as slaPATCH,
} from "@/app/api/v1/organizations/[organizationId]/sla/route";
import { GET as exportGET } from "@/app/api/v1/organizations/[organizationId]/issues/analytics/export/route";
import { POST as escalatePOST } from "@/app/api/v1/organizations/[organizationId]/issues/escalations/route";

const ORG = "11111111-1111-4111-8111-111111111111";
const context = {
  organizationId: ORG,
  user: { userId: "22222222-2222-4222-8222-222222222222" },
  membership: { role: "OWNER" },
} as unknown as OrganizationContext;
const params = (values: Record<string, string>) => ({ params: Promise.resolve(values) });
const analytics = {
  meanTimeToAcknowledgeMinutes: 3,
  meanTimeToResolveMinutes: 5,
  sampleSizes: { acknowledged: 1, resolved: 1 },
  sla: {
    acknowledgeMinutes: 60,
    resolveMinutes: 1440,
    activeBreaches: 0,
    acknowledgeBreaches: 0,
    resolveBreaches: 0,
  },
  policy: { acknowledgeMinutes: 60, resolveMinutes: 1440 },
  volumeTrend: [{ date: "2026-08-31", total: 1, active: 1, resolved: 0 }],
};

beforeEach(() => {
  mocks.requirePermission.mockReset().mockResolvedValue(context);
  mocks.readPolicy.mockReset().mockResolvedValue({ acknowledgeMinutes: 60, resolveMinutes: 1440 });
  mocks.updatePolicy.mockReset().mockResolvedValue({ acknowledgeMinutes: 30, resolveMinutes: 120 });
  mocks.readAnalytics.mockReset().mockResolvedValue(analytics);
  mocks.escalate
    .mockReset()
    .mockResolvedValue({ checkedIssues: 2, breachedIssues: 1, notificationsQueued: 1 });
});

describe("SLA and analytics routes", () => {
  it("reads and updates organization SLA policy", async () => {
    const read = await slaGET(
      new Request("https://guardian.test", { headers: { "x-request-id": "sla-req-123" } }),
      params({ organizationId: ORG }),
    );
    expect(read.status).toBe(200);
    expect(read.headers.get("x-request-id")).toBe("sla-req-123");
    const update = await slaPATCH(
      new Request("https://guardian.test", {
        method: "PATCH",
        body: JSON.stringify({ acknowledgeMinutes: 30, resolveMinutes: 120 }),
      }),
      params({ organizationId: ORG }),
    );
    expect(update.status).toBe(200);
    expect(mocks.updatePolicy).toHaveBeenCalled();
  });

  it("exports analytics as CSV with download headers", async () => {
    const response = await exportGET(
      new Request("https://guardian.test?format=csv"),
      params({ organizationId: ORG }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain("guardian-issue-analytics.csv");
    expect(await response.text()).toContain("active_sla_breaches");
  });

  it("triggers tenant-scoped breach escalation", async () => {
    const response = await escalatePOST(
      new Request("https://guardian.test"),
      params({ organizationId: ORG }),
    );
    expect(response.status).toBe(202);
    expect(mocks.escalate).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG, userId: context.user.userId }),
    );
  });
});
