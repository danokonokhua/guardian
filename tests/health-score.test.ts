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
): HealthScoreObservation {
  return { id, monitorId: `monitor-${id}`, monitorType, status, checkedAt: at };
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
});
