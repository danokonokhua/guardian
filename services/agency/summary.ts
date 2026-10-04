import "server-only";

import type {
  AgencyBrandingRecord,
  AgencyClientRecord,
  AgencyPortfolioOverview,
  ClientListItem,
  ClientRiskLevel,
} from "./types";

/**
 * Categorizes a client's risk posture according to their overall health score.
 */
export function calculateClientRisk(score: number): ClientRiskLevel {
  if (score >= 85) return "HEALTHY";
  if (score >= 65) return "DEGRADED";
  return "AT_RISK";
}

/**
 * Aggregates multi-client portfolio metrics, retainer revenue, and risk tiers.
 */
export function aggregateAgencyPortfolio(
  clients: AgencyClientRecord[],
  branding: AgencyBrandingRecord | null = null,
): AgencyPortfolioOverview {
  let totalMonthlyRetainerCents = 0;
  let scoreSum = 0;
  let activeClients = 0;
  let healthyCount = 0;
  let degradedCount = 0;
  let atRiskCount = 0;

  const clientListItems: ClientListItem[] = clients.map((client) => {
    const retainer = client.monthlyRetainerCents ?? 0;
    const score = client.healthScore ?? 85;
    const riskLevel = calculateClientRisk(score);

    if (client.status === "ACTIVE") {
      activeClients++;
      totalMonthlyRetainerCents += retainer;
      scoreSum += score;

      if (riskLevel === "HEALTHY") healthyCount++;
      else if (riskLevel === "DEGRADED") degradedCount++;
      else atRiskCount++;
    }

    return {
      id: client.id,
      clientName: client.clientName,
      clientDomain: client.clientDomain,
      contactEmail: client.contactEmail,
      contactName: client.contactName,
      status: client.status,
      monthlyRetainerCents: retainer,
      healthScore: score,
      riskLevel,
      lastScannedAt: client.lastScannedAt,
      notes: client.notes,
    };
  });

  const averageHealthScore = activeClients > 0 ? Math.round(scoreSum / activeClients) : 100;

  return {
    totalClients: clients.length,
    activeClients,
    totalMonthlyRetainerCents,
    averageHealthScore,
    healthyCount,
    degradedCount,
    atRiskCount,
    clients: clientListItems,
    branding,
  };
}
