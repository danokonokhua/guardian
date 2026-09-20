import { describe, expect, it } from "vitest";

import { calculateDigitalHealthScore, type HealthScoreIssue } from "@/lib/health-score";
import { generateGroundedRecommendations, type RecommendationIssue } from "@/lib/recommendations";

const at = "2026-09-12T12:00:00.000Z";

function issue(
  id: string,
  ruleId: string,
  severity: string = "HIGH",
  status = "OPEN",
  lastSeenAt: string = at,
): RecommendationIssue {
  return {
    id,
    ruleId,
    title: `${ruleId} issue`,
    summary: "The monitor recorded a bounded failure.",
    severity,
    status,
    lastSeenAt,
    businessImpact: "Customers may be unable to complete the intended journey.",
    impactConfidence: 0.82,
    metadata: { recommendedAction: "Review the affected path and restore the failing check." },
  };
}

function scoreFor(issues: readonly HealthScoreIssue[] = []) {
  return calculateDigitalHealthScore(
    [
      {
        id: "result-uptime",
        monitorId: "monitor-uptime",
        monitorType: "UPTIME",
        status: "UP",
        checkedAt: at,
      },
      {
        id: "result-form",
        monitorId: "monitor-form",
        monitorType: "FORM",
        status: "UP",
        checkedAt: at,
      },
      {
        id: "result-performance",
        monitorId: "monitor-performance",
        monitorType: "PERFORMANCE",
        status: "UP",
        checkedAt: at,
      },
    ],
    issues,
    new Date(at),
  );
}

describe("grounded recommendations v1", () => {
  it("links a persisted action to its current score component and issue evidence", () => {
    const sourceIssue = issue("issue-uptime", "monitor.uptime");
    const score = scoreFor([
      {
        id: sourceIssue.id,
        ruleId: sourceIssue.ruleId,
        severity: sourceIssue.severity,
        status: sourceIssue.status,
        title: sourceIssue.title,
        summary: sourceIssue.summary,
        businessImpact: sourceIssue.businessImpact,
        lastSeenAt: sourceIssue.lastSeenAt,
      },
    ]);

    const [recommendation] = generateGroundedRecommendations(score, [sourceIssue]);

    expect(recommendation).toMatchObject({
      id: "recommendation:issue-uptime",
      priority: "HIGH",
      title: "monitor.uptime issue",
      action: "Review the affected path and restore the failing check.",
      businessImpact: "Customers may be unable to complete the intended journey.",
      confidence: 0.82,
      source: {
        issueId: "issue-uptime",
        ruleId: "monitor.uptime",
        category: "WEBSITE",
        componentScore: 40,
        componentWeight: 25,
        observedAt: at,
      },
      evidence: {
        issueId: "issue-uptime",
        issueStatus: "OPEN",
        issueSeverity: "HIGH",
        lastSeenAt: at,
        coverageWeight: 65,
        scoreSourceVersion: "v1",
      },
    });
    expect(recommendation?.rationale).toContain("Active HIGH issue");
  });

  it("never invents an action for inactive or incomplete issue rows", () => {
    const score = scoreFor();
    const missingAction = issue("missing-action", "monitor.uptime");
    missingAction.metadata = { other: "not an action" };

    expect(
      generateGroundedRecommendations(score, [
        missingAction,
        issue("resolved", "monitor.form", "CRITICAL", "RESOLVED"),
        issue("ignored", "monitor.form", "CRITICAL", "IGNORED"),
        issue("invalid-severity", "monitor.form", "URGENT"),
      ]),
    ).toEqual([]);
  });

  it("orders by severity, then score weight, and caps the result deterministically", () => {
    const critical = issue("critical", "monitor.performance", "CRITICAL");
    const highWebsite = issue("high-website", "monitor.uptime", "HIGH", "OPEN", at);
    const highLead = issue("high-lead", "monitor.form", "HIGH", "OPEN", at);
    const score = scoreFor([
      ...[critical, highWebsite, highLead].map((candidate) => ({
        id: candidate.id,
        ruleId: candidate.ruleId,
        severity: candidate.severity,
        status: candidate.status,
        title: candidate.title,
        summary: candidate.summary,
        lastSeenAt: candidate.lastSeenAt,
      })),
    ]);

    const recommendations = generateGroundedRecommendations(
      score,
      [highWebsite, highLead, critical, highWebsite],
      2,
    );

    expect(recommendations.map((candidate) => candidate.source.issueId)).toEqual([
      "critical",
      "high-lead",
    ]);
  });

  it("bounds user-facing fields and excludes unrelated metadata", () => {
    const candidate = issue("issue-bounded", "monitor.uptime");
    candidate.title = "Title\nwith\tcontrol characters";
    candidate.summary = "A bounded summary.";
    candidate.metadata = {
      recommendedAction: `${"action ".repeat(120)}secret-token`,
      apiKey: "should-never-be-returned",
      technicalEvidence: { body: "a large response body" },
    };

    const result = generateGroundedRecommendations(scoreFor(), [candidate]);
    const serialized = JSON.stringify(result);

    expect(result).toHaveLength(1);
    expect(result[0]?.action.length).toBeLessThanOrEqual(500);
    expect(result[0]?.title).toBe("Title with control characters");
    expect(serialized).not.toContain("should-never-be-returned");
    expect(serialized).not.toContain("technicalEvidence");
  });

  it("retains an issue action when the score has no matching category, without fabricating linkage", () => {
    const candidate = issue("issue-unknown", "monitor.future");
    const [recommendation] = generateGroundedRecommendations(scoreFor(), [candidate]);

    expect(recommendation).toMatchObject({
      source: {
        issueId: "issue-unknown",
        ruleId: "monitor.future",
        category: null,
        componentScore: null,
        componentWeight: null,
      },
      evidence: { issueId: "issue-unknown", scoreSourceVersion: "v1" },
    });
  });
});
