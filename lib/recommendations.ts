import type { DigitalHealthScore, HealthScoreCategory } from "@/lib/health-score";

/**
 * A read-only, evidence-linked action for the current tenant health view.
 *
 * v1 deliberately contains no action lifecycle.  The action text is accepted
 * only when it was already attached to a persisted monitor issue by the
 * monitor adapter, and the score linkage is copied from the current
 * deterministic Digital Health Score.  This keeps recommendations grounded
 * without introducing an AI or an automatic-action boundary prematurely.
 */
export type GroundedRecommendationPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export interface GroundedRecommendation {
  id: string;
  priority: GroundedRecommendationPriority;
  title: string;
  action: string;
  rationale: string;
  businessImpact: string | null;
  confidence: number | null;
  source: {
    issueId: string;
    ruleId: string;
    category: HealthScoreCategory | null;
    componentScore: number | null;
    componentWeight: number | null;
    observedAt: string | null;
  };
  evidence: {
    issueId: string;
    issueStatus: string;
    issueSeverity: GroundedRecommendationPriority;
    lastSeenAt: string | null;
    coverageWeight: number;
    scoreSourceVersion: string;
  };
}

export interface RecommendationIssue {
  id: string;
  ruleId: string;
  title: string;
  summary: string;
  severity: string;
  status: string;
  lastSeenAt: Date | string | null | undefined;
  businessImpact?: string | null;
  impactConfidence?: number | null;
  metadata?: unknown;
}

const ACTIVE_ISSUE_STATUSES = new Set(["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"]);
const SEVERITY_RANK: Record<GroundedRecommendationPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
};
const MAX_RECOMMENDATIONS = 10;
const MAX_TEXT_LENGTH = 500;

function boundedText(value: string, limit = MAX_TEXT_LENGTH): string {
  const normalized = value
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function asIsoDate(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function readRecommendedAction(metadata: unknown): string | null {
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) return null;
  const value = (metadata as { recommendedAction?: unknown }).recommendedAction;
  if (typeof value !== "string") return null;
  const action = boundedText(value);
  return action.length > 0 ? action : null;
}

function priorityFromSeverity(value: string): GroundedRecommendationPriority | null {
  const priority = value.toUpperCase() as GroundedRecommendationPriority;
  return priority in SEVERITY_RANK ? priority : null;
}

function normalizedConfidence(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Number(Math.min(1, Math.max(0, value)).toFixed(4));
}

function componentForIssue(score: DigitalHealthScore, issueId: string) {
  return score.components.find(
    (component) =>
      component.evidence.issueIds.includes(issueId) ||
      component.drivers.some((driver) => driver.id === issueId),
  );
}

function observedTimestamp(issue: RecommendationIssue): number {
  const value = asIsoDate(issue.lastSeenAt);
  return value === null ? 0 : Date.parse(value) || 0;
}

function compareIssues(
  left: RecommendationIssue,
  right: RecommendationIssue,
  score: DigitalHealthScore,
): number {
  const leftPriority = priorityFromSeverity(left.severity);
  const rightPriority = priorityFromSeverity(right.severity);
  const severityDifference =
    (leftPriority === null ? 99 : SEVERITY_RANK[leftPriority]) -
    (rightPriority === null ? 99 : SEVERITY_RANK[rightPriority]);
  if (severityDifference !== 0) return severityDifference;

  const leftWeight = componentForIssue(score, left.id)?.weight ?? 0;
  const rightWeight = componentForIssue(score, right.id)?.weight ?? 0;
  if (leftWeight !== rightWeight) return rightWeight - leftWeight;

  const timeDifference = observedTimestamp(right) - observedTimestamp(left);
  if (timeDifference !== 0) return timeDifference;
  return left.id.localeCompare(right.id);
}

function recommendationForIssue(
  issue: RecommendationIssue,
  score: DigitalHealthScore,
): GroundedRecommendation | null {
  if (!issue.id || !ACTIVE_ISSUE_STATUSES.has(issue.status)) return null;
  const priority = priorityFromSeverity(issue.severity);
  const action = readRecommendedAction(issue.metadata);
  if (priority === null || action === null) return null;

  const component = componentForIssue(score, issue.id);
  const lastSeenAt = asIsoDate(issue.lastSeenAt);
  const summary = boundedText(issue.summary || "Active monitor evidence requires attention.");
  const componentContext = component
    ? component.score === null
      ? `${component.label} score coverage is pending.`
      : `${component.label} is currently ${component.score}/100.`
    : "This issue is not linked to a measured score component yet.";

  return {
    id: `recommendation:${issue.id}`,
    priority,
    title: boundedText(issue.title || "Active monitor issue"),
    action,
    rationale: `Active ${priority} issue: ${summary} ${componentContext}`,
    businessImpact: issue.businessImpact ? boundedText(issue.businessImpact) || null : null,
    confidence: normalizedConfidence(issue.impactConfidence),
    source: {
      issueId: issue.id,
      ruleId: boundedText(issue.ruleId, 120),
      category: component?.category ?? null,
      componentScore: component?.score ?? null,
      componentWeight: component?.weight ?? null,
      observedAt: lastSeenAt,
    },
    evidence: {
      issueId: issue.id,
      issueStatus: issue.status,
      issueSeverity: priority,
      lastSeenAt,
      coverageWeight: score.coverageWeight,
      scoreSourceVersion: score.sourceVersion,
    },
  };
}

/**
 * Derives a bounded list of grounded actions from tenant-scoped issue rows.
 *
 * Missing action metadata is intentionally a hard skip: v1 must never invent
 * generic advice.  Resolved/ignored issues are excluded, and duplicate issue
 * rows produce only one recommendation.  Results are deterministic so the
 * same score and issue set produce the same ordering.
 */
export function generateGroundedRecommendations(
  score: DigitalHealthScore,
  issues: readonly RecommendationIssue[],
  limit = MAX_RECOMMENDATIONS,
): GroundedRecommendation[] {
  const safeLimit = Math.min(MAX_RECOMMENDATIONS, Math.max(0, Math.floor(limit)));
  if (safeLimit === 0) return [];

  const seenIssueIds = new Set<string>();
  return [...issues]
    .filter((issue) => {
      if (seenIssueIds.has(issue.id)) return false;
      seenIssueIds.add(issue.id);
      return true;
    })
    .sort((left, right) => compareIssues(left, right, score))
    .map((issue) => recommendationForIssue(issue, score))
    .filter((recommendation): recommendation is GroundedRecommendation => recommendation !== null)
    .slice(0, safeLimit);
}
