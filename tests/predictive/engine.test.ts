import { describe, expect, it } from "vitest";
import {
  modelSslRunwayForecast,
  modelUptimeAnomalyForecast,
  modelLeadCollapseForecast,
  modelSeoVisibilityForecast,
  evaluatePredictiveRunway,
  type TelemetrySnapshot,
} from "@/services/predictive/engine";

describe("Predictive Failure Modeling Engine (PRD §20, §23, §25)", () => {
  describe("SSL Expiry Runway Modeling", () => {
    it("returns null if SSL days remaining is healthy (> 30 days)", () => {
      const snapshot: TelemetrySnapshot = {
        websiteId: "w1",
        hostname: "example.com",
        sslDaysRemaining: 75,
        recentLatenciesMs: [],
        recentHttpCodes: [],
      };
      expect(modelSslRunwayForecast(snapshot)).toBeNull();
    });

    it("triggers CRITICAL 98% probability forecast when <= 7 days remaining", () => {
      const snapshot: TelemetrySnapshot = {
        websiteId: "w1",
        hostname: "example.com",
        sslDaysRemaining: 4,
        recentLatenciesMs: [],
        recentHttpCodes: [],
      };
      const forecast = modelSslRunwayForecast(snapshot);
      expect(forecast).not.toBeNull();
      expect(forecast?.riskLevel).toBe("CRITICAL");
      expect(forecast?.probabilityScore).toBe(0.98);
      expect(forecast?.forecastRunwayDays).toBe(4);
      expect(forecast?.title).toContain("Critical TLS Certificate Expiration in 4 Days");
    });

    it("triggers HIGH 85% probability forecast when 8-14 days remaining", () => {
      const snapshot: TelemetrySnapshot = {
        websiteId: "w1",
        hostname: "example.com",
        sslDaysRemaining: 12,
        recentLatenciesMs: [],
        recentHttpCodes: [],
      };
      const forecast = modelSslRunwayForecast(snapshot);
      expect(forecast).not.toBeNull();
      expect(forecast?.riskLevel).toBe("HIGH");
      expect(forecast?.probabilityScore).toBe(0.85);
      expect(forecast?.forecastRunwayDays).toBe(12);
    });

    it("triggers MODERATE 50% renewal horizon warning when 15-30 days remaining", () => {
      const snapshot: TelemetrySnapshot = {
        websiteId: "w1",
        hostname: "example.com",
        sslDaysRemaining: 25,
        recentLatenciesMs: [],
        recentHttpCodes: [],
      };
      const forecast = modelSslRunwayForecast(snapshot);
      expect(forecast).not.toBeNull();
      expect(forecast?.riskLevel).toBe("MODERATE");
      expect(forecast?.forecastRunwayDays).toBe(25);
    });
  });

  describe("Uptime & Latency Anomaly Modeling", () => {
    it("detects critical infrastructure collapse on steep latency slope and 5xx spikes", () => {
      const snapshot: TelemetrySnapshot = {
        websiteId: "w1",
        hostname: "example.com",
        // Latency climbs from 300ms to 2800ms
        recentLatenciesMs: [250, 310, 280, 290, 2200, 2600, 2800, 3100],
        recentHttpCodes: [200, 200, 200, 200, 502, 504, 200, 503],
      };
      const forecast = modelUptimeAnomalyForecast(snapshot);
      expect(forecast).not.toBeNull();
      expect(forecast?.riskLevel).toBe("CRITICAL");
      expect(forecast?.probabilityScore).toBeGreaterThanOrEqual(0.90);
      expect(forecast?.predictedWindow).toBe("NEXT_24_HOURS");
    });

    it("detects high risk progressive latency degradation", () => {
      const snapshot: TelemetrySnapshot = {
        websiteId: "w1",
        hostname: "example.com",
        recentLatenciesMs: [400, 420, 450, 1200, 1350, 1400],
        recentHttpCodes: [200, 200, 200, 200, 200, 200],
      };
      const forecast = modelUptimeAnomalyForecast(snapshot);
      expect(forecast).not.toBeNull();
      expect(forecast?.riskLevel).toBe("HIGH");
      expect(forecast?.probabilityScore).toBe(0.74);
    });
  });

  describe("Lead Funnel & Form Collapse Modeling", () => {
    it("models critical lead form collapse when failure rate exceeds 40%", () => {
      const snapshot: TelemetrySnapshot = {
        websiteId: "w1",
        hostname: "example.com",
        recentLatenciesMs: [],
        recentHttpCodes: [],
        formTotalSubmissions: 10,
        formSubmissionFailures: 5, // 50% fail rate
      };
      const forecast = modelLeadCollapseForecast(snapshot);
      expect(forecast).not.toBeNull();
      expect(forecast?.targetVector).toBe("LEAD_COLLAPSE");
      expect(forecast?.riskLevel).toBe("CRITICAL");
      expect(forecast?.probabilityScore).toBe(0.95);
    });

    it("returns null when form conversion is healthy", () => {
      const snapshot: TelemetrySnapshot = {
        websiteId: "w1",
        hostname: "example.com",
        recentLatenciesMs: [],
        recentHttpCodes: [],
        formTotalSubmissions: 20,
        formSubmissionFailures: 1, // 5% fail rate
      };
      expect(modelLeadCollapseForecast(snapshot)).toBeNull();
    });
  });

  describe("Cross-Vector Pipeline Evaluation", () => {
    it("synthesizes multiple signals and orders forecasts by probability score", () => {
      const snapshot: TelemetrySnapshot = {
        websiteId: "w1",
        hostname: "example.com",
        sslDaysRemaining: 5, // CRITICAL (0.98)
        recentLatenciesMs: [400, 420, 450, 1200, 1350, 1400], // HIGH (0.74)
        recentHttpCodes: [200, 200, 200, 200, 200, 200],
        missingMetaCount: 4, // MODERATE (0.68)
      };

      const forecasts = evaluatePredictiveRunway(snapshot);
      expect(forecasts).toHaveLength(3);
      expect(forecasts[0]!.targetVector).toBe("SSL_EXPIRY");
      expect(forecasts[0]!.probabilityScore).toBe(0.98);
      expect(forecasts[1]!.targetVector).toBe("UPTIME_ANOMALY");
      expect(forecasts[2]!.targetVector).toBe("SEO_VISIBILITY_DROP");
    });
  });
});
