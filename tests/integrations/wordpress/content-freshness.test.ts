import { describe, expect, it, vi } from "vitest";
import { detectWordpressAnomalies, type WordpressTelemetryPayload } from "@/services/integrations/wordpress/collector";
import * as issueEngine from "@/lib/issue-engine";

describe("WordPress Content Freshness Anomalies", () => {
  it("detects RULE_WP_STALE_CONTENT when posts are older than 60 days", async () => {
    const recordedFindings: any[] = [];
    vi.spyOn(issueEngine, "recordFindingWithClient").mockImplementation(async (finding: any) => {
      recordedFindings.push(finding);
      return { id: "issue-freshness-1", created: true };
    });
    vi.spyOn(issueEngine, "resolveFindingScoped").mockResolvedValue();

    const telemetry: WordpressTelemetryPayload = {
      wpVersion: "6.7.1",
      phpVersion: "8.3.0",
      debugMode: false,
      httpsEnforced: true,
      updatesAvailable: { core: 0, plugins: 0, themes: 0 },
      plugins: [],
      themes: [],
      contentFreshness: {
        lastPostDate: "2026-06-01T00:00:00Z",
        lastPostTitle: "Old Launch Article",
        daysSinceLastPost: 133,
        isStale: true,
      },
    };

    const anomalies = await detectWordpressAnomalies(
      telemetry,
      { organizationId: "org-1", websiteId: "site-1" },
      {} as any,
    );

    expect(anomalies.detectedCount).toBe(1);
    expect(anomalies.issueIds).toContain("issue-freshness-1");
    const finding = recordedFindings.find((f) => f.ruleId === "RULE_WP_STALE_CONTENT");
    expect(finding).toBeDefined();
    expect(finding.title).toContain("133 days");
  });
});

