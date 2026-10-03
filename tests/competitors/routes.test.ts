import { beforeEach, describe, expect, it, vi } from "vitest";

const { permissionMock, competitorServiceMock, competitorRepoMock } = vi.hoisted(() => ({
  permissionMock: vi.fn(),
  competitorServiceMock: {
    registerCompetitor: vi.fn(),
    probeCompetitor: vi.fn(),
    syncAllCompetitors: vi.fn(),
    getCompetitorDetails: vi.fn(),
    updateCompetitorDetails: vi.fn(),
    removeCompetitor: vi.fn(),
    getCompetitorComparisonMetrics: vi.fn(),
  },
  competitorRepoMock: {
    listCompetitors: vi.fn(),
  },
}));

vi.mock("@/lib/auth/context", () => ({ requirePermission: permissionMock }));
vi.mock("@/services/competitors/service", () => competitorServiceMock);
vi.mock("@/services/competitors/repository", () => competitorRepoMock);

import {
  GET as getCompetitorsRoute,
  POST as postCompetitorsRoute,
} from "@/app/api/v1/organizations/[organizationId]/competitors/route";
import {
  GET as getSingleCompetitorRoute,
  PATCH as patchSingleCompetitorRoute,
  DELETE as deleteSingleCompetitorRoute,
} from "@/app/api/v1/organizations/[organizationId]/competitors/[competitorId]/route";
import { POST as postSyncRoute } from "@/app/api/v1/organizations/[organizationId]/competitors/[competitorId]/sync/route";

const ORG = "org-test-99";
const COMP_ID = "comp-123";
const context = {
  organizationId: ORG,
  plan: "PRO",
  user: { userId: "user-1", email: "admin@example.com" },
  membership: { organizationId: ORG, role: "OWNER" },
};

describe("Competitor Intelligence API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissionMock.mockResolvedValue(context);
  });

  describe("GET /competitors", () => {
    it("returns list of competitors and head-to-head comparison", async () => {
      competitorRepoMock.listCompetitors.mockResolvedValue([
        { id: COMP_ID, name: "Acme", domain: "acme.com" },
      ]);
      competitorServiceMock.getCompetitorComparisonMetrics.mockResolvedValue({
        websiteId: "site-1",
        competitorsCount: 1,
        avgCompetitorSpeedMs: 180,
      });
      const response = await getCompetitorsRoute(
        new Request("https://guardian.test/api/v1/organizations/org-test-99/competitors"),
        { params: Promise.resolve({ organizationId: ORG }) },
      );
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.competitors).toHaveLength(1);
      expect(json.data.comparison.competitorsCount).toBe(1);
    });
  });

  describe("POST /competitors", () => {
    it("validates input and registers competitor", async () => {
      competitorServiceMock.registerCompetitor.mockResolvedValue({
        competitor: { id: COMP_ID, name: "Rival Corp", domain: "rival.com" },
        snapshot: { id: "snap-1" },
        diff: { hasChanges: false },
        anomalies: { detectedCount: 0, resolvedCount: 0, issueIds: [] },
      });
      const request = new Request("https://guardian.test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Rival Corp",
          urlOrDomain: "https://rival.com",
          isSandbox: true,
        }),
      });
      const response = await postCompetitorsRoute(request, {
        params: Promise.resolve({ organizationId: ORG }),
      });
      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.data.competitor.name).toBe("Rival Corp");
      expect(competitorServiceMock.registerCompetitor).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: "Rival Corp",
          urlOrDomain: "https://rival.com",
          isSandbox: true,
        }),
      );
    });
  });

  describe("Single Competitor Routes", () => {
    it("GET details", async () => {
      competitorServiceMock.getCompetitorDetails.mockResolvedValue({
        competitor: { id: COMP_ID, name: "Acme" },
        latestSnapshot: { pageTitle: "Acme Title" },
        snapshots: [],
      });
      const res = await getSingleCompetitorRoute(new Request("https://guardian.test"), {
        params: Promise.resolve({ organizationId: ORG, competitorId: COMP_ID }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.competitor.name).toBe("Acme");
    });

    it("PATCH updates competitor properties", async () => {
      competitorServiceMock.updateCompetitorDetails.mockResolvedValue({
        id: COMP_ID,
        name: "Acme Updated",
        status: "ACTIVE",
      });
      const req = new Request("https://guardian.test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Acme Updated" }),
      });
      const res = await patchSingleCompetitorRoute(req, {
        params: Promise.resolve({ organizationId: ORG, competitorId: COMP_ID }),
      });
      expect(res.status).toBe(200);
      expect((await res.json()).data.name).toBe("Acme Updated");
    });

    it("DELETE removes competitor", async () => {
      competitorServiceMock.removeCompetitor.mockResolvedValue(true);
      const res = await deleteSingleCompetitorRoute(new Request("https://guardian.test"), {
        params: Promise.resolve({ organizationId: ORG, competitorId: COMP_ID }),
      });
      expect(res.status).toBe(200);
      expect((await res.json()).data.deleted).toBe(true);
    });
  });

  describe("POST /sync", () => {
    it("triggers competitor probe", async () => {
      competitorServiceMock.probeCompetitor.mockResolvedValue({
        competitor: { id: COMP_ID },
        snapshot: { id: "snap-2", hasChanges: true },
        diff: { hasChanges: true, changeSummary: "Title updated" },
        anomalies: { detectedCount: 1, resolvedCount: 0, issueIds: ["iss-1"] },
      });
      const req = new Request("https://guardian.test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSandbox: true }),
      });
      const res = await postSyncRoute(req, {
        params: Promise.resolve({ organizationId: ORG, competitorId: COMP_ID }),
      });
      expect(res.status).toBe(200);
      expect((await res.json()).data.snapshot.hasChanges).toBe(true);
    });
  });
});

