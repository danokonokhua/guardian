import { beforeEach, describe, expect, it, vi } from "vitest";

const { permissionMock, marketingServiceMock } = vi.hoisted(() => ({
  permissionMock: vi.fn(),
  marketingServiceMock: {
    getCrossChannelPerformance: vi.fn(),
    registerCampaign: vi.fn(),
    seedSandboxMarketingCampaigns: vi.fn(),
    getCampaignDetails: vi.fn(),
    updateCampaignDetails: vi.fn(),
    removeCampaign: vi.fn(),
  },
}));

vi.mock("@/lib/auth/context", () => ({ requirePermission: permissionMock }));
vi.mock("@/services/marketing/service", () => marketingServiceMock);

import {
  GET as getMarketingRoute,
  POST as postMarketingRoute,
} from "@/app/api/v1/organizations/[organizationId]/marketing/route";

import {
  GET as getCampaignRoute,
  PATCH as patchCampaignRoute,
  DELETE as deleteCampaignRoute,
} from "@/app/api/v1/organizations/[organizationId]/marketing/campaigns/[campaignId]/route";

import { POST as postSyncRoute } from "@/app/api/v1/organizations/[organizationId]/marketing/sync/route";

const ORG = "org-mkt-99";
const CAMP_ID = "camp-123";
const context = {
  organizationId: ORG,
  user: { userId: "user-1", email: "admin@example.com" },
  membership: { organizationId: ORG, role: "OWNER" },
};

describe("Marketing Intelligence API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissionMock.mockResolvedValue(context);
  });

  describe("GET /marketing", () => {
    it("returns cross-channel overview and campaigns", async () => {
      marketingServiceMock.getCrossChannelPerformance.mockResolvedValue({
        totalSpendCents: 50000,
        totalConversions: 20,
        blendedRoas: 3.5,
        channels: [],
        campaigns: [],
      });

      const response = await getMarketingRoute(
        new Request("https://guardian.test/api/v1/organizations/org-mkt-99/marketing"),
        { params: Promise.resolve({ organizationId: ORG }) },
      );

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.overview.totalSpendCents).toBe(50000);
      expect(json.data.overview.blendedRoas).toBe(3.5);
    });
  });

  describe("POST /marketing", () => {
    it("creates a new marketing campaign", async () => {
      marketingServiceMock.registerCampaign.mockResolvedValue({
        id: CAMP_ID,
        name: "Google Search Core",
        channel: "GOOGLE_ADS",
      });

      const req = new Request("https://guardian.test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Google Search Core",
          channel: "GOOGLE_ADS",
          budgetDailyCents: 5000,
        }),
      });

      const response = await postMarketingRoute(req, {
        params: Promise.resolve({ organizationId: ORG }),
      });

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.data.name).toBe("Google Search Core");
    });

    it("seeds sandbox marketing demo data", async () => {
      marketingServiceMock.seedSandboxMarketingCampaigns.mockResolvedValue({
        totalSpendCents: 150000,
        campaigns: [{ id: "c1" }, { id: "c2" }],
      });

      const req = new Request("https://guardian.test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seedSandbox: true }),
      });

      const response = await postMarketingRoute(req, {
        params: Promise.resolve({ organizationId: ORG }),
      });

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.data.seeded).toBe(true);
      expect(marketingServiceMock.seedSandboxMarketingCampaigns).toHaveBeenCalled();
    });
  });

  describe("Single Campaign Routes", () => {
    it("GET details", async () => {
      marketingServiceMock.getCampaignDetails.mockResolvedValue({
        campaign: { id: CAMP_ID, name: "Meta Retargeting" },
        latestSnapshot: { spendCents: 12000 },
        snapshots: [],
      });

      const res = await getCampaignRoute(new Request("https://guardian.test"), {
        params: Promise.resolve({ organizationId: ORG, campaignId: CAMP_ID }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.campaign.name).toBe("Meta Retargeting");
    });

    it("PATCH updates campaign properties", async () => {
      marketingServiceMock.updateCampaignDetails.mockResolvedValue({
        id: CAMP_ID,
        name: "Updated Name",
        status: "PAUSED",
      });

      const req = new Request("https://guardian.test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAUSED" }),
      });

      const res = await patchCampaignRoute(req, {
        params: Promise.resolve({ organizationId: ORG, campaignId: CAMP_ID }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.status).toBe("PAUSED");
    });

    it("DELETE removes campaign", async () => {
      marketingServiceMock.removeCampaign.mockResolvedValue(true);

      const res = await deleteCampaignRoute(new Request("https://guardian.test"), {
        params: Promise.resolve({ organizationId: ORG, campaignId: CAMP_ID }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.deleted).toBe(true);
    });
  });

  describe("POST /sync", () => {
    it("syncs and refreshes marketing intelligence", async () => {
      marketingServiceMock.getCrossChannelPerformance.mockResolvedValue({
        totalSpendCents: 75000,
      });

      const req = new Request("https://guardian.test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const res = await postSyncRoute(req, {
        params: Promise.resolve({ organizationId: ORG }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.synced).toBe(true);
    });
  });
});
