import { describe, expect, it, vi, beforeEach } from "vitest";
import { assertCanUsePredictiveIntelligence } from "@/lib/billing/entitlements";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import {
  getPredictiveOverview,
  generatePredictiveForecastsForOrg,
  acknowledgeForecast,
} from "@/services/predictive/service";
import * as repository from "@/services/predictive/repository";

vi.mock("@/services/predictive/repository");

const mockTenantScope = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  userId: "user-test-1",
  role: "ADMIN" as const,
};

describe("Predictive Intelligence Service & Threat Aggregator (PRD §20, §23, §25)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Plan Entitlement Gating", () => {
    it("blocks FREE and STARTER plans from predictive intelligence", () => {
      expect(() => assertCanUsePredictiveIntelligence("FREE")).toThrow(ForbiddenError);
      expect(() => assertCanUsePredictiveIntelligence("STARTER")).toThrow(ForbiddenError);
    });

    it("allows GROWTH, PRO, AGENCY, WHITE_LABEL, and ENTERPRISE tiers", () => {
      expect(() => assertCanUsePredictiveIntelligence("GROWTH")).not.toThrow();
      expect(() => assertCanUsePredictiveIntelligence("PRO")).not.toThrow();
      expect(() => assertCanUsePredictiveIntelligence("AGENCY")).not.toThrow();
      expect(() => assertCanUsePredictiveIntelligence("WHITE_LABEL")).not.toThrow();
      expect(() => assertCanUsePredictiveIntelligence("ENTERPRISE")).not.toThrow();
    });
  });

  describe("Threat Overview & Aggregation", () => {
    it("aggregates active forecasts and calculates estimated financial exposure", async () => {
      vi.spyOn(repository, "listPredictiveForecastsByOrg").mockResolvedValue([
        {
          id: "f-1",
          organizationId: mockTenantScope.organizationId,
          websiteId: "w-1",
          targetVector: "SSL_EXPIRY",
          riskLevel: "CRITICAL",
          probabilityScore: 0.98,
          predictedWindow: "NEXT_7_DAYS",
          forecastRunwayDays: 3,
          title: "Critical TLS Certificate Expiration",
          predictedImpact: "Immediate browser warnings",
          underlyingSignals: [],
          preventiveAction: "Renew certificate immediately",
          status: "ACTIVE",
          generatedAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "f-2",
          organizationId: mockTenantScope.organizationId,
          websiteId: "w-1",
          targetVector: "UPTIME_ANOMALY",
          riskLevel: "HIGH",
          probabilityScore: 0.75,
          predictedWindow: "NEXT_7_DAYS",
          forecastRunwayDays: 4,
          title: "Rising latency slope",
          predictedImpact: "Slow responses",
          underlyingSignals: [],
          preventiveAction: "Scale server tier",
          status: "ACTIVE",
          generatedAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const overview = await getPredictiveOverview(mockTenantScope, "PRO");

      expect(overview.totalForecasts).toBe(2);
      expect(overview.criticalCount).toBe(1);
      expect(overview.highCount).toBe(1);
      expect(overview.moderateCount).toBe(0);
      // 1 critical ($1,250) + 1 high ($450) = $1,700
      expect(overview.projectedRevenueRiskUsd).toBe(1700);
      expect(overview.forecasts).toHaveLength(2);
    });
  });

  describe("Forecast Lifecycle Triage", () => {
    it("updates forecast status to ACKNOWLEDGED or RESOLVED", async () => {
      vi.spyOn(repository, "findPredictiveForecastById").mockResolvedValue({
        id: "f-1",
        organizationId: mockTenantScope.organizationId,
        websiteId: null,
        targetVector: "SSL_EXPIRY",
        riskLevel: "CRITICAL",
        probabilityScore: 0.98,
        predictedWindow: "NEXT_7_DAYS",
        forecastRunwayDays: 3,
        title: "SSL",
        predictedImpact: "Loss",
        underlyingSignals: [],
        preventiveAction: "Renew",
        status: "ACTIVE",
        generatedAt: new Date(),
        updatedAt: new Date(),
      });

      vi.spyOn(repository, "updatePredictiveForecastStatus").mockResolvedValue({
        id: "f-1",
        organizationId: mockTenantScope.organizationId,
        websiteId: null,
        targetVector: "SSL_EXPIRY",
        riskLevel: "CRITICAL",
        probabilityScore: 0.98,
        predictedWindow: "NEXT_7_DAYS",
        forecastRunwayDays: 3,
        title: "SSL",
        predictedImpact: "Loss",
        underlyingSignals: [],
        preventiveAction: "Renew",
        status: "ACKNOWLEDGED",
        generatedAt: new Date(),
        updatedAt: new Date(),
      });

      const updated = await acknowledgeForecast(mockTenantScope, "f-1", "ACKNOWLEDGED");
      expect(updated.status).toBe("ACKNOWLEDGED");
      expect(repository.updatePredictiveForecastStatus).toHaveBeenCalledWith(
        mockTenantScope,
        "f-1",
        "ACKNOWLEDGED"
      );
    });

    it("throws NotFoundError when forecast is missing", async () => {
      vi.spyOn(repository, "findPredictiveForecastById").mockResolvedValue(null);

      await expect(
        acknowledgeForecast(mockTenantScope, "f-missing", "RESOLVED")
      ).rejects.toThrow(NotFoundError);
    });
  });
});
