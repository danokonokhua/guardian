import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrganizationContext } from "@/lib/auth/context";

const { permissionMock, getSummaryMock, upsertSubMock, startTrialMock } = vi.hoisted(() => ({
  permissionMock: vi.fn(),
  getSummaryMock: vi.fn(),
  upsertSubMock: vi.fn(),
  startTrialMock: vi.fn(),
}));

vi.mock("@/lib/auth/context", () => ({ requirePermission: permissionMock }));
vi.mock("@/services/billing/repository", () => ({
  getBillingSummary: getSummaryMock,
  upsertSubscription: upsertSubMock,
  startTrial: startTrialMock,
}));

import { GET, POST } from "@/app/api/v1/organizations/[organizationId]/billing/route";
import { POST as checkoutPOST } from "@/app/api/v1/organizations/[organizationId]/billing/checkout/route";
import { POST as portalPOST } from "@/app/api/v1/organizations/[organizationId]/billing/portal/route";

const ORG = "11111111-1111-4111-8111-111111111111";
const context = {
  organizationId: ORG,
  user: {
    userId: "22222222-2222-4222-8222-222222222222",
    email: "test@example.com",
    status: "ACTIVE",
  },
  membership: { organizationId: ORG, role: "OWNER", status: "ACTIVE" },
} as unknown as OrganizationContext;

beforeEach(() => {
  permissionMock.mockReset().mockResolvedValue(context);
  getSummaryMock.mockReset().mockResolvedValue({
    organizationId: ORG,
    organizationName: "Acme Corp",
    plan: "FREE",
    subscription: null,
    limits: {
      maxWebsites: 1,
      maxBusinesses: 1,
      maxTeamMembers: 1,
      minFrequencyMinutes: 60,
      historyDays: 7,
    },
    usage: { websitesCount: 1, businessesCount: 1, membersCount: 1 },
    trial: { isTrialing: false, trialEndsAt: null, daysRemaining: null },
    invoices: [],
  });
  upsertSubMock.mockReset().mockResolvedValue({
    id: "sub-1",
    organizationId: ORG,
    plan: "GROWTH",
    status: "ACTIVE",
  });
  startTrialMock.mockReset().mockResolvedValue({
    id: "sub-2",
    organizationId: ORG,
    plan: "PRO",
    status: "TRIALING",
  });
});

describe("Billing API endpoints", () => {
  it("GET returns billing summary for organization", async () => {
    const response = await GET(
      new Request("https://guardian.test/api/v1/organizations/org-1/billing"),
      { params: Promise.resolve({ organizationId: ORG }) },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.organizationName).toBe("Acme Corp");
    expect(body.data.plan).toBe("FREE");
  });

  it("POST starts 14-day trial when requested", async () => {
    const response = await POST(
      new Request("https://guardian.test/api/v1/organizations/org-1/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start_trial", plan: "PRO" }),
      }),
      { params: Promise.resolve({ organizationId: ORG }) },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.plan).toBe("PRO");
    expect(body.data.status).toBe("TRIALING");
    expect(startTrialMock).toHaveBeenCalledTimes(1);
  });

  it("POST changes plan when requested", async () => {
    const response = await POST(
      new Request("https://guardian.test/api/v1/organizations/org-1/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change_plan", plan: "GROWTH" }),
      }),
      { params: Promise.resolve({ organizationId: ORG }) },
    );
    expect(response.status).toBe(200);
    expect(upsertSubMock).toHaveBeenCalledTimes(1);
  });

  it("POST checkout endpoint creates checkout session URL", async () => {
    const response = await checkoutPOST(
      new Request("https://guardian.test/api/v1/organizations/org-1/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "PRO", interval: "MONTHLY" }),
      }),
      { params: Promise.resolve({ organizationId: ORG }) },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.url).toBeDefined();
    expect(body.data.sessionId).toBeDefined();
  });

  it("POST portal endpoint creates portal session URL", async () => {
    const response = await portalPOST(
      new Request("https://guardian.test/api/v1/organizations/org-1/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ organizationId: ORG }) },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.url).toBeDefined();
  });
});
