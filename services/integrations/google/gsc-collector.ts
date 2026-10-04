import "server-only";

import type { Prisma } from "@prisma/client";
import { recordFindingWithClient } from "@/lib/issue-engine";

export interface GSCReportSummary {
  periodDays: number;
  currentClicks: number;
  previousClicks: number;
  clickChangePct: number;
  impressions: number;
  averageCtrPct: number;
  averagePosition: number;
  topQueries: Array<{ query: string; clicks: number; impressions: number; position: number }>;
  syncedAt: string;
}

export function analyzeGSCMetrics(data: {
  currentClicks: number;
  previousClicks: number;
  impressions: number;
  averageCtrPct: number;
  averagePosition: number;
  topQueries?: Array<{ query: string; clicks: number; impressions: number; position: number }>;
}): GSCReportSummary {
  const previous = Math.max(1, data.previousClicks);
  const diff = data.currentClicks - previous;
  const clickChangePct = Math.round((diff / previous) * 100);

  return {
    periodDays: 28,
    currentClicks: data.currentClicks,
    previousClicks: data.previousClicks,
    clickChangePct,
    impressions: data.impressions,
    averageCtrPct: data.averageCtrPct,
    averagePosition: Math.round(data.averagePosition * 10) / 10,
    topQueries: data.topQueries ?? [
      { query: "guardian business operations", clicks: 320, impressions: 2400, position: 2.4 },
      { query: "digital business monitoring", clicks: 180, impressions: 3800, position: 5.1 },
      { query: "website uptime and lead forms", clicks: 95, impressions: 1600, position: 7.8 },
    ],
    syncedAt: new Date().toISOString(),
  };
}

export async function detectGSCAnomalies(
  summary: GSCReportSummary,
  context: { organizationId: string; websiteId: string },
  prisma: Pick<Prisma.TransactionClient, "website" | "issue" | "issueActivity" | "$executeRaw">,
): Promise<{ detected: boolean; issueId?: string }> {
  // Rule: Organic clicks drop by >35%
  if (summary.clickChangePct <= -35 && summary.previousClicks >= 30) {
    const result = await recordFindingWithClient(
      {
        organizationId: context.organizationId,
        websiteId: context.websiteId,
        ruleId: "RULE_GSC_SEARCH_VISIBILITY_DROP",
        subjectKey: "gsc-clicks-drop",
        severity: "HIGH",
        title: `Google Search Console: ${Math.abs(summary.clickChangePct)}% decrease in organic clicks`,
        summary: `Organic Google search clicks dropped from ${summary.previousClicks.toLocaleString()} to ${summary.currentClicks.toLocaleString()} (${summary.clickChangePct}% change).`,
        businessImpact:
          "Declines in organic search visibility directly reduce high-intent visitor acquisition without ad spend. Sudden drops often indicate Google algorithmic shifts, indexation loss, or accidental noindex / robots.txt exclusions.",
        impactConfidence: 0.9,
        recommendedAction:
          "Inspect Google Search Console Indexing and Pages reports for newly excluded URLs, 404 crawl errors, or core web vital regressions.",
        technicalEvidence: {
          currentClicks: summary.currentClicks,
          previousClicks: summary.previousClicks,
          clickChangePct: summary.clickChangePct,
          impressions: summary.impressions,
          averageCtrPct: summary.averageCtrPct,
          averagePosition: summary.averagePosition,
        },
      },
      prisma,
    );

    return { detected: true, issueId: result.id };
  }

  return { detected: false };
}

export async function fetchGSCMetrics(
  accessToken: string,
  siteUrl: string,
): Promise<GSCReportSummary> {
  if (!accessToken || accessToken.startsWith("mock_") || siteUrl.startsWith("mock_")) {
    return analyzeGSCMetrics({
      currentClicks: 1420,
      previousClicks: 1510,
      impressions: 48600,
      averageCtrPct: 2.9,
      averagePosition: 8.4,
    });
  }

  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate: "28daysAgo",
      endDate: "today",
      dimensions: ["query"],
      rowLimit: 5,
    }),
  });

  if (!response.ok) {
    throw new Error(`Search Console query failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    rows?: Array<{
      keys?: string[];
      clicks?: number;
      impressions?: number;
      ctr?: number;
      position?: number;
    }>;
  };

  const rows = data.rows ?? [];
  const totalClicks = rows.reduce((sum, r) => sum + (r.clicks ?? 0), 0);
  const totalImpressions = rows.reduce((sum, r) => sum + (r.impressions ?? 0), 0);
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgPos =
    rows.length > 0 ? rows.reduce((sum, r) => sum + (r.position ?? 0), 0) / rows.length : 0;

  return analyzeGSCMetrics({
    currentClicks: totalClicks,
    previousClicks: totalClicks,
    impressions: totalImpressions,
    averageCtrPct: Math.round(avgCtr * 10) / 10,
    averagePosition: avgPos,
    topQueries: rows.slice(0, 5).map((r) => ({
      query: r.keys?.[0] ?? "unknown",
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      position: Math.round((r.position ?? 0) * 10) / 10,
    })),
  });
}
