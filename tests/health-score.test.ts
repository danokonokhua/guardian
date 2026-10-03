import { describe, expect, it } from "vitest";

import {
  calculateDigitalHealthScore,
  HEALTH_SCORE_WEIGHTS,
  type HealthScoreIssue,
  type HealthScoreObservation,
} from "@/lib/health-score";

const at = "2026-09-11T12:00:00.000Z";

function observation(
  id: string,
  monitorType: string,
  status: "UP" | "DOWN" | "ERROR" | null = "UP",
  score?: number | null,
): HealthScoreObservation {
  return { id, monitorId: `monitor-${id}`, monitorType, status, score, checkedAt: at };
}

function issue(id: string, ruleId: string, severity: string, status = "OPEN"): HealthScoreIssue {
  return {
    id,
    ruleId,
    severity,
    status,
    title: `${ruleId} issue`,
    summary: "Evidence-backed issue",
    businessImpact: "Customers may be affected.",
    lastSeenAt: at,
  };
}

describe("Digital Health Score v1", () => {
  it("uses PRD weights and marks unimplemented categories as pending", () => {
    const score = calculateDigitalHealthScore(
      [
        observation("uptime", "UPTIME"),
        observation("form", "FORM"),
        observation("performance", "PERFORMANCE"),
        observation("seo", "SEO"),
        observation("ssl", "SSL"),
      ],
      [],
      new Date(at),
    );

    expect(score).toMatchObject({
      score: 100,
      state: "PARTIAL",
      coverageWeight:
        HEALTH_SCORE_WEIGHTS.WEBSITE +
        HEALTH_SCORE_WEIGHTS.LEAD_GENERATION +
        HEALTH_SCORE_WEIGHTS.PERFORMANCE +
        HEALTH_SCORE_WEIGHTS.SEO +
        HEALTH_SCORE_WEIGHTS.SECURITY,
      calculatedAt: at,
      sourceVersion: "v1",
    });
    expect(score.components).toHaveLength(6);
    expect(score.components.find((component) => component.category === "REPUTATION")).toMatchObject(
      {
        state: "PENDING",
        score: null,
        evidence: { monitorCount: 0, resultCount: 0 },
      },
    );
  });

  it("averages measurable results, excludes errors, and exposes bounded evidence", () => {
    const score = calculateDigitalHealthScore(
      [
        observation("up", "UPTIME", "UP"),
        observation("down", "LINKS", "DOWN"),
        observation("error", "PERFORMANCE", "ERROR"),
      ],
      [],
      new Date(at),
    );

    const website = score.components.find((component) => component.category === "WEBSITE");
    expect(website).toMatchObject({
      state: "MEASURED",
      score: 50,
      evidence: { upCount: 1, downCount: 1, errorCount: 0, resultCount: 2 },
    });
    const performance = score.components.find((component) => component.category === "PERFORMANCE");
    expect(performance).toMatchObject({
      state: "PENDING",
      score: null,
      evidence: { errorCount: 1, resultCount: 1 },
    });
    expect(score.coverageWeight).toBe(HEALTH_SCORE_WEIGHTS.WEBSITE);
  });

  it("applies only the highest active issue penalty and exposes its driver", () => {
    const score = calculateDigitalHealthScore(
      [observation("uptime", "UPTIME")],
      [
        issue("medium", "monitor.uptime", "MEDIUM"),
        issue("high", "monitor.uptime", "HIGH"),
        issue("resolved", "monitor.uptime", "CRITICAL", "RESOLVED"),
      ],
      new Date(at),
    );

    const website = score.components.find((component) => component.category === "WEBSITE");
    expect(website?.score).toBe(40);
    expect(website?.evidence.issueIds).toEqual(["high", "medium"]);
    expect(website?.drivers.map((driver) => driver.id)).toEqual(["high", "medium"]);
    expect(website?.explanation).toContain("60-point");
  });

  it("returns insufficient data when every result is an error or absent", () => {
    const score = calculateDigitalHealthScore(
      [observation("uptime", "UPTIME", "ERROR")],
      [],
      new Date(at),
    );

    expect(score).toMatchObject({ score: null, state: "INSUFFICIENT_DATA", coverageWeight: 0 });
    expect(score.explanation).toContain("No measurable monitor results");
  });

  it("measures the REPUTATION category when Google Business Profile data is provided", () => {
    const score = calculateDigitalHealthScore(
      [
        observation("uptime", "UPTIME"),
        observation("form", "FORM"),
        observation("performance", "PERFORMANCE"),
        observation("seo", "SEO"),
        observation("ssl", "SSL"),
        observation("gbp", "REPUTATION", "UP", 96),
      ],
      [],
      new Date(at),
    );

    expect(score.state).toBe("MEASURED");
    expect(score.coverageWeight).toBe(100);
    const reputation = score.components.find((component) => component.category === "REPUTATION");
    expect(reputation).toMatchObject({
      state: "MEASURED",
      score: 96,
      weight: HEALTH_SCORE_WEIGHTS.REPUTATION,
      evidence: { upCount: 1, downCount: 0, resultCount: 1 },
    });
  });

  it("penalizes the REPUTATION category when active GBP issues are present", () => {
    const score = calculateDigitalHealthScore(
      [observation("gbp", "BUSINESS_PROFILE", "UP", 90)],
      [issue("unanswered", "RULE_GBP_UNANSWERED_REVIEWS", "MEDIUM")],
      new Date(at),
    );

    const reputation = score.components.find((component) => component.category === "REPUTATION");
    expect(reputation?.state).toBe("MEASURED");
    // 90 base score - 35 (MEDIUM penalty) = 55
    expect(reputation?.score).toBe(55);
    expect(reputation?.evidence.issueIds).toEqual(["unanswered"]);
    expect(reputation?.drivers.map((d) => d.id)).toEqual(["unanswered"]);
    expect(reputation?.explanation).toContain("35-point");
  });
});
