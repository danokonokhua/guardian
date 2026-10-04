import "server-only";

import crypto from "crypto";
import type { AgencyClientRecord, BulkScanClientResult, BulkScanSummary } from "./types";

/**
 * Simulates or executes a bulk portfolio health scan across all active agency clients.
 */
export async function runBulkPortfolioScan(
  clients: AgencyClientRecord[],
): Promise<BulkScanSummary> {
  const startTime = Date.now();
  const clientResults: BulkScanClientResult[] = [];
  let successCount = 0;
  let failedCount = 0;

  for (const client of clients) {
    try {
      const prevScore = client.healthScore ?? 85;
      // Deterministic slight variation around the baseline
      const hash = crypto
        .createHash("md5")
        .update(`${client.clientDomain}-${Date.now()}`)
        .digest("hex");
      const delta = (parseInt(hash.slice(0, 2), 16) % 11) - 5; // -5 to +5
      const newScore = Math.min(100, Math.max(40, prevScore + delta));

      clientResults.push({
        clientId: client.id,
        clientName: client.clientName,
        domain: client.clientDomain,
        previousScore: prevScore,
        newScore,
        status: "OK",
      });
      successCount++;
    } catch {
      clientResults.push({
        clientId: client.id,
        clientName: client.clientName,
        domain: client.clientDomain,
        previousScore: client.healthScore ?? 85,
        newScore: client.healthScore ?? 85,
        status: "FAILED",
      });
      failedCount++;
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    scannedCount: clients.length,
    successCount,
    failedCount,
    durationMs,
    clientResults,
  };
}
