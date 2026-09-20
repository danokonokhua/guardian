/**
 * Explainable Digital Health Score v1.
 *
 * The scorer is deliberately pure: it accepts the latest tenant-scoped
 * observations and active issues supplied by the health repository and never
 * reads a database or an environment variable.  This makes the scoring rule
 * deterministic, testable, and safe to reuse for snapshot persistence.
 *
 * PRD §10 weights:
 *   Website 25 · Lead Generation 25 · Performance 15 · SEO 15 ·
 *   Security 10 · Reputation 10
 *
 * Missing categories are PENDING rather than healthy.  Their weights are
 * excluded from the denominator and exposed as `coverageWeight`, so a partial
 * score cannot be mistaken for a complete assessment.  UP contributes 100,
 * DOWN contributes 0, and ERROR is recorded but is not measurable.  Active
 * issue severity applies a bounded category penalty (the highest active issue
 * only) so warning findings such as an expiring certificate affect the score
 * even when the transport itself is still reachable.
 */

export const HEALTH_SCORE_SOURCE_VERSION = "v1" as const;
export const HEALTH_SCORE_TOTAL_WEIGHT = 100 as const;

export const HEALTH_SCORE_WEIGHTS = {
  WEBSITE: 25,
  LEAD_GENERATION: 25,
  PERFORMANCE: 15,
  SEO: 15,
  SECURITY: 10,
  REPUTATION: 10,
} as const;

export type HealthScoreCategory = keyof typeof HEALTH_SCORE_WEIGHTS;
export type HealthScoreState = "MEASURED" | "PARTIAL" | "INSUFFICIENT_DATA";
export type HealthScoreComponentState = "MEASURED" | "PENDING";

export interface HealthScoreObservation {
  id: string;
  monitorId: string;
  monitorType: string;
  status: string | null | undefined;
  checkedAt: Date | string | null | undefined;
}

export interface HealthScoreIssue {
  id: string;
  ruleId: string;
  severity: string;
  status: string;
  title: string;
  summary: string;
  businessImpact?: string | null;
  lastSeenAt?: Date | string | null;
}

export interface HealthScoreIssueDriver {
  id: string;
  ruleId: string;
  severity: string;
  title: string;
  summary: string;
  businessImpact: string | null;
  lastSeenAt: string | null;
}

export interface HealthScoreEvidence {
  monitorTypes: string[];
  monitorIds: string[];
  resultIds: string[];
  issueIds: string[];
  issueSeverities: string[];
  upCount: number;
  downCount: number;
  errorCount: number;
  resultCount: number;
  monitorCount: number;
}

export interface HealthScoreComponent {
  category: HealthScoreCategory;
  label: string;
  weight: number;
  score: number | null;
  state: HealthScoreComponentState;
  contribution: number;
  explanation: string;
  evidence: HealthScoreEvidence;
  drivers: HealthScoreIssueDriver[];
}

export interface DigitalHealthScore {
  score: number | null;
  state: HealthScoreState;
  coverageWeight: number;
  totalWeight: typeof HEALTH_SCORE_TOTAL_WEIGHT;
  sourceVersion: typeof HEALTH_SCORE_SOURCE_VERSION;
  calculatedAt: string;
  explanation: string;
  components: HealthScoreComponent[];
}

const CATEGORY_LABELS: Record<HealthScoreCategory, string> = {
  WEBSITE: "Website",
  LEAD_GENERATION: "Lead generation",
  PERFORMANCE: "Performance",
  SEO: "SEO",
  SECURITY: "Security",
  REPUTATION: "Reputation",
};

const CATEGORY_ORDER = Object.keys(HEALTH_SCORE_WEIGHTS) as HealthScoreCategory[];
const ACTIVE_ISSUE_STATUSES = new Set(["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"]);
const SEVERITY_PENALTIES: Record<string, number> = {
  CRITICAL: 100,
  HIGH: 60,
  MEDIUM: 35,
  LOW: 15,
  INFO: 0,
};

function categoryForMonitorType(monitorType: string): HealthScoreCategory | null {
  switch (monitorType) {
    case "UPTIME":
    case "LINKS":
      return "WEBSITE";
    case "FORM":
      return "LEAD_GENERATION";
    case "PERFORMANCE":
      return "PERFORMANCE";
    case "SEO":
      return "SEO";
    case "SSL":
    case "SECURITY":
      return "SECURITY";
    default:
      return null;
  }
}

function categoryForRule(ruleId: string): HealthScoreCategory | null {
  if (ruleId === "monitor.form") return "LEAD_GENERATION";
  if (ruleId === "monitor.performance") return "PERFORMANCE";
  if (ruleId === "monitor.seo") return "SEO";
  if (ruleId === "monitor.security" || ruleId === "monitor.ssl") return "SECURITY";
  if (
    ruleId === "monitor.uptime" ||
    ruleId === "monitor.http_status" ||
    ruleId === "monitor.links"
  ) {
    return "WEBSITE";
  }
  return null;
}

function asIsoDate(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function latestFirst(left: HealthScoreIssue, right: HealthScoreIssue): number {
  const leftTime = Date.parse(asIsoDate(left.lastSeenAt) ?? "") || 0;
  const rightTime = Date.parse(asIsoDate(right.lastSeenAt) ?? "") || 0;
  if (rightTime !== leftTime) return rightTime - leftTime;
  const severityRank: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
    INFO: 4,
  };
  return (severityRank[left.severity] ?? 99) - (severityRank[right.severity] ?? 99);
}

function boundedUnique(values: string[], limit: number): string[] {
  return [...new Set(values.filter((value) => value !== ""))].slice(0, limit);
}

function componentExplanation(
  label: string,
  score: number | null,
  evidence: HealthScoreEvidence,
  penalty: number,
): string {
  if (score === null) {
    return evidence.errorCount > 0
      ? `${label} has no measurable result yet; ${evidence.errorCount} latest check${evidence.errorCount === 1 ? "" : "s"} returned an error.`
      : `${label} has no monitor result yet.`;
  }
  const resultSummary = `${evidence.upCount} UP, ${evidence.downCount} DOWN${evidence.errorCount > 0 ? `, ${evidence.errorCount} ERROR` : ""}`;
  return penalty > 0
    ? `${label} scores ${score}/100 from the latest results (${resultSummary}); active issue severity applied a ${penalty}-point cap.`
    : `${label} scores ${score}/100 from the latest results (${resultSummary}).`;
}

/**
 * Calculates a score from latest monitor observations and active issue rows.
 * Inputs must already be tenant-scoped by the caller.
 */
export function calculateDigitalHealthScore(
  observations: readonly HealthScoreObservation[],
  issues: readonly HealthScoreIssue[],
  calculatedAt: Date = new Date(),
): DigitalHealthScore {
  const components: HealthScoreComponent[] = CATEGORY_ORDER.map((category) => {
    const categoryObservations = observations.filter(
      (observation) => categoryForMonitorType(observation.monitorType) === category,
    );
    const categoryIssues = issues
      .filter(
        (issue) =>
          ACTIVE_ISSUE_STATUSES.has(issue.status) && categoryForRule(issue.ruleId) === category,
      )
      .sort(latestFirst);
    const upCount = categoryObservations.filter((item) => item.status === "UP").length;
    const downCount = categoryObservations.filter((item) => item.status === "DOWN").length;
    const errorCount = categoryObservations.filter((item) => item.status === "ERROR").length;
    const resultCount = upCount + downCount + errorCount;
    const measurableCount = upCount + downCount;
    const baseScore = measurableCount === 0 ? null : Math.round((upCount * 100) / measurableCount);
    const penalty = categoryIssues.reduce(
      (highest, issue) => Math.max(highest, SEVERITY_PENALTIES[issue.severity] ?? 0),
      0,
    );
    const score = baseScore === null ? null : Math.max(0, baseScore - penalty);
    const evidence: HealthScoreEvidence = {
      monitorTypes: boundedUnique(
        categoryObservations.map((observation) => observation.monitorType),
        8,
      ),
      monitorIds: boundedUnique(
        categoryObservations.map((observation) => observation.monitorId),
        20,
      ),
      resultIds: boundedUnique(
        categoryObservations
          .filter((observation) => observation.status !== undefined && observation.status !== null)
          .map((observation) => observation.id),
        20,
      ),
      issueIds: boundedUnique(
        categoryIssues.map((issue) => issue.id),
        10,
      ),
      issueSeverities: boundedUnique(
        categoryIssues.map((issue) => issue.severity),
        5,
      ),
      upCount,
      downCount,
      errorCount,
      resultCount,
      monitorCount: categoryObservations.length,
    };
    const drivers: HealthScoreIssueDriver[] = categoryIssues.slice(0, 5).map((issue) => ({
      id: issue.id,
      ruleId: issue.ruleId,
      severity: issue.severity,
      title: issue.title,
      summary: issue.summary,
      businessImpact: issue.businessImpact ?? null,
      lastSeenAt: asIsoDate(issue.lastSeenAt),
    }));
    const state: HealthScoreComponentState = score === null ? "PENDING" : "MEASURED";
    return {
      category,
      label: CATEGORY_LABELS[category],
      weight: HEALTH_SCORE_WEIGHTS[category],
      score,
      state,
      contribution: 0,
      explanation: componentExplanation(CATEGORY_LABELS[category], score, evidence, penalty),
      evidence,
      drivers,
    };
  });

  const measuredWeight = components
    .filter((component) => component.state === "MEASURED")
    .reduce((sum, component) => sum + component.weight, 0);
  const score =
    measuredWeight === 0
      ? null
      : Math.round(
          components.reduce(
            (sum, component) =>
              sum + (component.score === null ? 0 : component.score * component.weight),
            0,
          ) / measuredWeight,
        );
  const state: HealthScoreState =
    measuredWeight === 0
      ? "INSUFFICIENT_DATA"
      : measuredWeight === HEALTH_SCORE_TOTAL_WEIGHT
        ? "MEASURED"
        : "PARTIAL";
  const finalComponents = components.map((component) => ({
    ...component,
    contribution:
      score === null || component.score === null
        ? 0
        : Number(((component.score * component.weight) / measuredWeight).toFixed(2)),
  }));
  const pending = finalComponents
    .filter((component) => component.state === "PENDING")
    .map((component) => component.label.toLowerCase());
  const explanation =
    state === "INSUFFICIENT_DATA"
      ? "No measurable monitor results are available yet. Run a check to establish the first score."
      : state === "PARTIAL"
        ? `Score uses ${measuredWeight}% of the available category weight. Pending: ${pending.join(", ")}.`
        : "All PRD score categories have measurable results.";

  return {
    score,
    state,
    coverageWeight: measuredWeight,
    totalWeight: HEALTH_SCORE_TOTAL_WEIGHT,
    sourceVersion: HEALTH_SCORE_SOURCE_VERSION,
    calculatedAt: calculatedAt.toISOString(),
    explanation,
    components: finalComponents,
  };
}
