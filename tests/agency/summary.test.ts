import { describe, expect, it } from "vitest";
import {
  calculateClientRisk,
  aggregateAgencyPortfolio,
} from "@/services/agency/summary";
import { runBulkPortfolioScan } from "@/services/agency/bulk-scanner";

describe("Agency Platform Summary & Bulk Scanner", () => {
  describe("calculateClientRisk", () => {
    it("categorizes client health scores into risk tiers accurately", () => {
      expect(calculateClientRisk(95)).toBe("HEALTHY");
      expect(calculateClientRisk(85)).toBe("HEALTHY");
      expect(calculateClientRisk(84)).toBe("DEGRADED");
      expect(calculateClientRisk(65)).toBe("DEGRADED");
      expect(calculateClientRisk(64)).toBe("AT_RISK");
      expect(calculateClientRisk(30)).toBe("AT_RISK");
    });
  });

  describe("aggregateAgencyPortfolio", () => {
    it("aggregates portfolio statistics, retainers, and risk distribution", () => {
      const clients: any[] = [
        {
          id: "c1",
          clientName: "Client Alpha",
          clientDomain: "alpha.com",
          status: "ACTIVE",
          monthlyRetainerCents: 100000, // $1,000
          healthScore: 92, // Healthy
        },
        {
          id: "c2",
          clientName: "Client Beta",
          clientDomain: "beta.com",
          status: "ACTIVE",
          monthlyRetainerCents: 50000, // $500
          healthScore: 75, // Degraded
        },
        {
          id: "c3",
          clientName: "Client Gamma",
          clientDomain: "gamma.com",
          status: "ACTIVE",
          monthlyRetainerCents: 150000, // $1,500
          healthScore: 50, // At Risk
        },
        {
          id: "c4",
          clientName: "Client Inactive",
          clientDomain: "inactive.com",
          status: "PAUSED",
          monthlyRetainerCents: 80000,
          healthScore: 90,
        },
      ];

      const overview = aggregateAgencyPortfolio(clients, null);

      expect(overview.totalClients).toBe(4);
      expect(overview.activeClients).toBe(3);
      expect(overview.totalMonthlyRetainerCents).toBe(300000); // $3,000 total active retainer MRR
      expect(overview.averageHealthScore).toBe(72); // (92 + 75 + 50) / 3 = 72.3 -> 72
      expect(overview.healthyCount).toBe(1);
      expect(overview.degradedCount).toBe(1);
      expect(overview.atRiskCount).toBe(1);
    });
  });

  describe("runBulkPortfolioScan", () => {
    it("scans all active clients and returns updated scores", async () => {
      const clients: any[] = [
        { id: "c1", clientName: "Alpha", clientDomain: "alpha.com", healthScore: 80 },
        { id: "c2", clientName: "Beta", clientDomain: "beta.com", healthScore: 90 },
      ];

      const result = await runBulkPortfolioScan(clients);

      expect(result.scannedCount).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(result.clientResults).toHaveLength(2);
      expect(result.clientResults[0]?.status).toBe("OK");
      expect(result.clientResults[1]?.status).toBe("OK");
    });
  });
});

