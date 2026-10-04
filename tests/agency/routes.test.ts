import { beforeEach, describe, expect, it, vi } from "vitest";

const { permissionMock, agencyServiceMock, agencyRepoMock } = vi.hoisted(() => ({
  permissionMock: vi.fn(),
  agencyServiceMock: {
    getPortfolioOverview: vi.fn(),
    registerAgencyClient: vi.fn(),
    updateAgencyClientDetails: vi.fn(),
    removeAgencyClient: vi.fn(),
    bulkScanPortfolio: vi.fn(),
    saveAgencyBranding: vi.fn(),
  },
  agencyRepoMock: {
    findAgencyClientById: vi.fn(),
    getAgencyBranding: vi.fn(),
  },
}));

vi.mock("@/lib/auth/context", () => ({ requirePermission: permissionMock }));
vi.mock("@/services/agency/service", () => agencyServiceMock);
vi.mock("@/services/agency/repository", () => agencyRepoMock);

import { GET as getAgencyRoute } from "@/app/api/v1/organizations/[organizationId]/agency/route";
import { POST as postClientsRoute } from "@/app/api/v1/organizations/[organizationId]/agency/clients/route";
import {
  GET as getClientRoute,
  PATCH as patchClientRoute,
  DELETE as deleteClientRoute,
} from "@/app/api/v1/organizations/[organizationId]/agency/clients/[clientId]/route";
import { POST as postBulkScanRoute } from "@/app/api/v1/organizations/[organizationId]/agency/bulk-scan/route";
import {
  GET as getBrandingRoute,
  PUT as putBrandingRoute,
} from "@/app/api/v1/organizations/[organizationId]/agency/branding/route";

const ORG = "org-agency-99";
const CLIENT_ID = "client-123";
const context = {
  organizationId: ORG,
  user: { userId: "user-1", email: "agency@example.com" },
  membership: { organizationId: ORG, role: "OWNER" },
};

describe("Agency Platform API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissionMock.mockResolvedValue(context);
  });

  describe("GET /agency", () => {
    it("returns agency portfolio overview", async () => {
      agencyServiceMock.getPortfolioOverview.mockResolvedValue({
        totalClients: 5,
        activeClients: 4,
        totalMonthlyRetainerCents: 250000,
        averageHealthScore: 88,
        clients: [],
      });

      const response = await getAgencyRoute(
        new Request("https://guardian.test/api/v1/organizations/org-agency-99/agency"),
        { params: Promise.resolve({ organizationId: ORG }) },
      );

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.overview.totalClients).toBe(5);
      expect(json.data.overview.averageHealthScore).toBe(88);
    });
  });

  describe("POST /agency/clients", () => {
    it("registers new client in portfolio", async () => {
      agencyServiceMock.registerAgencyClient.mockResolvedValue({
        id: CLIENT_ID,
        clientName: "Beta Corp",
        clientDomain: "betacorp.com",
        monthlyRetainerCents: 60000,
      });

      const req = new Request("https://guardian.test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: "Beta Corp",
          clientDomain: "betacorp.com",
          monthlyRetainerCents: 60000,
        }),
      });

      const res = await postClientsRoute(req, {
        params: Promise.resolve({ organizationId: ORG }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.clientName).toBe("Beta Corp");
    });
  });

  describe("Single Client Routes", () => {
    it("GET details", async () => {
      agencyRepoMock.findAgencyClientById.mockResolvedValue({
        id: CLIENT_ID,
        clientName: "Acme",
      });

      const res = await getClientRoute(new Request("https://guardian.test"), {
        params: Promise.resolve({ organizationId: ORG, clientId: CLIENT_ID }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.clientName).toBe("Acme");
    });

    it("PATCH updates client", async () => {
      agencyServiceMock.updateAgencyClientDetails.mockResolvedValue({
        id: CLIENT_ID,
        clientName: "Acme Updated",
      });

      const req = new Request("https://guardian.test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName: "Acme Updated" }),
      });

      const res = await patchClientRoute(req, {
        params: Promise.resolve({ organizationId: ORG, clientId: CLIENT_ID }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.clientName).toBe("Acme Updated");
    });

    it("DELETE removes client", async () => {
      agencyServiceMock.removeAgencyClient.mockResolvedValue(true);

      const res = await deleteClientRoute(new Request("https://guardian.test"), {
        params: Promise.resolve({ organizationId: ORG, clientId: CLIENT_ID }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.deleted).toBe(true);
    });
  });

  describe("POST /agency/bulk-scan", () => {
    it("triggers bulk portfolio scan", async () => {
      agencyServiceMock.bulkScanPortfolio.mockResolvedValue({
        scannedCount: 3,
        successCount: 3,
        failedCount: 0,
        durationMs: 45,
        clientResults: [],
      });

      const res = await postBulkScanRoute(
        new Request("https://guardian.test", { method: "POST" }),
        {
          params: Promise.resolve({ organizationId: ORG }),
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.scannedCount).toBe(3);
    });
  });

  describe("Branding Routes", () => {
    it("GET branding", async () => {
      agencyRepoMock.getAgencyBranding.mockResolvedValue({
        companyName: "Acme Agency",
        isWhiteLabelActive: true,
      });

      const res = await getBrandingRoute(new Request("https://guardian.test"), {
        params: Promise.resolve({ organizationId: ORG }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.branding.companyName).toBe("Acme Agency");
    });

    it("PUT saves branding", async () => {
      agencyServiceMock.saveAgencyBranding.mockResolvedValue({
        companyName: "Apex Studios",
        brandPrimaryColor: "#06b6d4",
      });

      const req = new Request("https://guardian.test", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: "Apex Studios" }),
      });

      const res = await putBrandingRoute(req, {
        params: Promise.resolve({ organizationId: ORG }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.companyName).toBe("Apex Studios");
    });
  });
});
