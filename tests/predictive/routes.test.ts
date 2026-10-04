import { beforeEach, describe, expect, it, vi } from "vitest";

const { permissionMock, roleMock, predictiveServiceMock } = vi.hoisted(() => ({
  permissionMock: vi.fn(),
  roleMock: vi.fn(),
  predictiveServiceMock: {
    getPredictiveOverview: vi.fn(),
    generatePredictiveForecastsForOrg: vi.fn(),
    acknowledgeForecast: vi.fn(),
  },
}));

vi.mock("@/lib/auth/context", () => ({
  requirePermission: permissionMock,
  requireRole: roleMock,
}));

vi.mock("@/services/predictive/service", () => predictiveServiceMock);

import {
  GET as getPredictiveOverviewRoute,
  POST as postGenerateForecastsRoute,
} from "@/app/api/v1/organizations/[organizationId]/predictive/route";
import { PATCH as patchForecastStatusRoute } from "@/app/api/v1/organizations/[organizationId]/predictive/[forecastId]/route";

const ORG = "org-pred-123";
const authContext = {
  organizationId: ORG,
  user: { userId: "user-admin", email: "admin@example.com" },
  membership: { organizationId: ORG, role: "ADMIN" },
};

describe("Predictive Intelligence REST API Routes (PRD §20, §23, §25)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissionMock.mockResolvedValue(authContext);
    roleMock.mockResolvedValue(authContext);
  });

  describe("GET /api/v1/organizations/[organizationId]/predictive", () => {
    it("returns active forecasts, risk counts, and revenue exposure", async () => {
      predictiveServiceMock.getPredictiveOverview.mockResolvedValue({
        totalForecasts: 3,
        criticalCount: 1,
        highCount: 1,
        moderateCount: 1,
        projectedRevenueRiskUsd: 1850,
        forecasts: [],
      });

      const response = await getPredictiveOverviewRoute(
        new Request(`https://guardian.test/api/v1/organizations/${ORG}/predictive`),
        { params: Promise.resolve({ organizationId: ORG }) }
      );

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.totalForecasts).toBe(3);
      expect(json.data.criticalCount).toBe(1);
      expect(json.data.projectedRevenueRiskUsd).toBe(1850);
      expect(permissionMock).toHaveBeenCalledWith(ORG, "org:read");
    });
  });

  describe("POST /api/v1/organizations/[organizationId]/predictive", () => {
    it("triggers predictive telemetry risk evaluation across tenant websites", async () => {
      predictiveServiceMock.generatePredictiveForecastsForOrg.mockResolvedValue({
        websitesAnalyzed: 4,
        newForecastsGenerated: 2,
      });

      const response = await postGenerateForecastsRoute(
        new Request(`https://guardian.test/api/v1/organizations/${ORG}/predictive`, {
          method: "POST",
        }),
        { params: Promise.resolve({ organizationId: ORG }) }
      );

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.data.websitesAnalyzed).toBe(4);
      expect(json.data.newForecastsGenerated).toBe(2);
      expect(roleMock).toHaveBeenCalledWith(ORG, "ADMIN");
    });
  });

  describe("PATCH /api/v1/organizations/[organizationId]/predictive/[forecastId]", () => {
    it("updates forecast triage status with validation", async () => {
      predictiveServiceMock.acknowledgeForecast.mockResolvedValue({
        id: "fc-123",
        status: "ACKNOWLEDGED",
      });

      const response = await patchForecastStatusRoute(
        new Request(
          `https://guardian.test/api/v1/organizations/${ORG}/predictive/fc-123`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "ACKNOWLEDGED" }),
          }
        ),
        {
          params: Promise.resolve({
            organizationId: ORG,
            forecastId: "fc-123",
          }),
        }
      );

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.status).toBe("ACKNOWLEDGED");
      expect(roleMock).toHaveBeenCalledWith(ORG, "ADMIN");
      expect(predictiveServiceMock.acknowledgeForecast).toHaveBeenCalledWith(
        expect.anything(),
        "fc-123",
        "ACKNOWLEDGED"
      );
    });

    it("rejects invalid status values", async () => {
      const response = await patchForecastStatusRoute(
        new Request(
          `https://guardian.test/api/v1/organizations/${ORG}/predictive/fc-123`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "INVALID_STATUS" }),
          }
        ),
        {
          params: Promise.resolve({
            organizationId: ORG,
            forecastId: "fc-123",
          }),
        }
      );

      expect(response.status).toBe(400);
    });
  });
});
