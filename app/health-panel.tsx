"use client";

import { useEffect, useState } from "react";
import type { GroundedRecommendation } from "@/lib/recommendations";

type HealthData = {
  healthScore?: {
    score: number | null;
    state: "MEASURED" | "PARTIAL" | "INSUFFICIENT_DATA";
    coverageWeight: number;
    totalWeight: number;
    sourceVersion: string;
    calculatedAt: string;
    explanation: string;
    components: Array<{
      category: string;
      label: string;
      weight: number;
      score: number | null;
      state: "MEASURED" | "PENDING";
      contribution: number;
      explanation: string;
      evidence: {
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
      };
      drivers: Array<{
        id: string;
        ruleId: string;
        severity: string;
        title: string;
        summary: string;
        businessImpact: string | null;
        lastSeenAt: string | null;
      }>;
    }>;
  };
  recommendations?: GroundedRecommendation[];
  healthScoreHistory?: Array<{
    id: string;
    score: number | null;
    state: string;
    coverageWeight: number;
    sourceVersion: string;
    calculatedAt: string;
  }>;
  summary: {
    monitors: number;
    up: number;
    down: number;
    error: number;
    pending: number;
    activeIssues: number;
    recoveredIssues: number;
  };
  recentResults: Array<{
    id: string;
    status: string;
    checkedAt: string;
    responseTimeMs: number | null;
    httpStatusCode: number | null;
    monitorType: string;
    websiteName: string;
  }>;
  issues: Array<{
    id: string;
    ruleId?: string;
    title: string;
    summary: string;
    severity: string;
    status: string;
    lastSeenAt: string;
    firstSeenAt?: string;
    resolvedAt: string | null;
    assignedToId?: string | null;
    assignedTo?: { id: string; email: string; name: string | null } | null;
    technicalEvidence?: unknown;
    businessImpact?: string | null;
    impactConfidence?: number | null;
    metadata?: unknown;
    websiteName: string;
  }>;
  responseHistory: Array<{
    checkedAt: string;
    responseTimeMs: number;
    websiteName: string;
  }>;
};

type OrganizationMember = { userId: string; email: string; name: string | null; role: string };
type SavedView = {
  id: string;
  name: string;
  filters: { status: string; severity: string; sort: string; order: string };
};
type IssueAnalytics = {
  meanTimeToAcknowledgeMinutes: number | null;
  meanTimeToResolveMinutes: number | null;
  sampleSizes: { acknowledged: number; resolved: number };
  sla: {
    acknowledgeMinutes: number;
    resolveMinutes: number;
    activeBreaches: number;
    acknowledgeBreaches: number;
    resolveBreaches: number;
  };
  volumeTrend: Array<{ date: string; total: number; active: number; resolved: number }>;
  policy: { acknowledgeMinutes: number; resolveMinutes: number };
};

export function HealthPanel({
  organizationId,
  userId,
  canManageIssues = false,
}: {
  organizationId: string;
  userId?: string;
  canManageIssues?: boolean;
}) {
  const [result, setResult] = useState<{ organizationId: string; data: HealthData } | null>(null);
  const [error, setError] = useState<{ organizationId: string; message: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyIssueId, setBusyIssueId] = useState<string | null>(null);
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [queue, setQueue] = useState<{
    organizationId: string;
    items: HealthData["issues"];
    nextCursor: string | null;
  } | null>(null);
  const [cursorStack, setCursorStack] = useState<Array<string | null>>([null]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [viewName, setViewName] = useState("");
  const [analytics, setAnalytics] = useState<IssueAnalytics | null>(null);
  const [slaDraft, setSlaDraft] = useState({ acknowledgeMinutes: 60, resolveMinutes: 1440 });
  const [slaSaving, setSlaSaving] = useState(false);
  const [slaMessage, setSlaMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "RESOLVED" | "IGNORED">(
    "ALL",
  );
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"lastSeenAt" | "severity" | "status">("lastSeenAt");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/organizations/${organizationId}/health`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `Unable to load health results (request ${response.headers.get("x-request-id") ?? "unknown"})`,
          );
        }
        return (await response.json()) as { data: HealthData };
      })
      .then((response) => {
        if (!cancelled) {
          setError(null);
          setResult({ organizationId, data: response.data });
          setQueue({ organizationId, items: response.data.issues, nextCursor: null });
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError({
            organizationId,
            message: cause instanceof Error ? cause.message : "Unable to load health results",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  useEffect(() => {
    fetch(`/api/v1/organizations/${organizationId}/issues/analytics`)
      .then(async (response) =>
        response.ok ? ((await response.json()) as { data?: IssueAnalytics }) : { data: undefined },
      )
      .then((payload) => {
        const policy = payload.data?.policy;
        setAnalytics(payload.data ?? null);
        if (policy) setSlaDraft(policy);
      })
      .catch(() => setAnalytics(null));
  }, [organizationId]);

  const saveSlaPolicy = async () => {
    setSlaSaving(true);
    setSlaMessage(null);
    try {
      const response = await fetch(`/api/v1/organizations/${organizationId}/sla`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(slaDraft),
      });
      if (!response.ok)
        throw new Error(
          `Unable to save SLA policy (request ${response.headers.get("x-request-id") ?? "unknown"})`,
        );
      const payload = (await response.json()) as {
        data: { acknowledgeMinutes: number; resolveMinutes: number };
      };
      setSlaDraft(payload.data);
      setSlaMessage("SLA policy saved.");
    } catch (cause: unknown) {
      setSlaMessage(cause instanceof Error ? cause.message : "Unable to save SLA policy");
    } finally {
      setSlaSaving(false);
    }
  };

  const currentCursor = cursorStack[cursorStack.length - 1] ?? null;
  useEffect(() => {
    if (result?.organizationId !== organizationId) return;
    const search = new URLSearchParams({ limit: "25", sort: sortBy, order: "desc" });
    if (statusFilter !== "ALL") search.set("status", statusFilter);
    if (severityFilter !== "ALL") search.set("severity", severityFilter);
    if (currentCursor) search.set("cursor", currentCursor);
    fetch(`/api/v1/organizations/${organizationId}/issues?${search.toString()}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load incident queue");
        return (await response.json()) as {
          data?: { items?: HealthData["issues"]; nextCursor?: string | null };
        };
      })
      .then((payload) => {
        if (Array.isArray(payload.data?.items)) {
          setQueue({
            organizationId,
            items: payload.data.items,
            nextCursor: payload.data.nextCursor ?? null,
          });
        }
      })
      .catch(() => undefined)
      .finally(() => setQueueLoading(false));
  }, [currentCursor, organizationId, result?.organizationId, severityFilter, sortBy, statusFilter]);

  useEffect(() => {
    fetch(`/api/v1/organizations/${organizationId}/issues/views`)
      .then(async (response) =>
        response.ok ? ((await response.json()) as { data?: SavedView[] }) : { data: [] },
      )
      .then((payload) => setSavedViews(Array.isArray(payload.data) ? payload.data : []))
      .catch(() => setSavedViews([]));
  }, [organizationId]);

  useEffect(() => {
    if (!canManageIssues) return;
    fetch(`/api/v1/organizations/${organizationId}/members`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load organization members");
        return (await response.json()) as { data: OrganizationMember[] };
      })
      .then((payload) => setMembers(payload.data))
      .catch(() => setMembers([]));
  }, [canManageIssues, organizationId]);

  if (error?.organizationId === organizationId) {
    return (
      <p role="alert" className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-red-300">
        {error.message}
      </p>
    );
  }
  if (result?.organizationId !== organizationId) {
    return <p className="p-4 text-sm text-neutral-400">Loading health results…</p>;
  }

  const {
    healthScore,
    recommendations = [],
    healthScoreHistory,
    summary,
    recentResults,
    issues,
    responseHistory,
  } = result.data;
  const maxResponse = Math.max(...responseHistory.map((point) => point.responseTimeMs), 1);
  const severityRank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
  const visibleIssues = issues
    .filter((issue) =>
      statusFilter === "ALL"
        ? true
        : statusFilter === "ACTIVE"
          ? issue.status !== "RESOLVED" && issue.status !== "IGNORED"
          : issue.status === statusFilter,
    )
    .filter((issue) => severityFilter === "ALL" || issue.severity === severityFilter)
    .sort((left, right) => {
      if (sortBy === "severity")
        return (severityRank[left.severity] ?? 99) - (severityRank[right.severity] ?? 99);
      if (sortBy === "status") return left.status.localeCompare(right.status);
      return new Date(right.lastSeenAt).getTime() - new Date(left.lastSeenAt).getTime();
    });
  const queueIssues = queue?.organizationId === organizationId ? queue.items : visibleIssues;
  const severityCounts = (severity: string) =>
    issues.filter(
      (issue) =>
        issue.severity === severity && issue.status !== "RESOLVED" && issue.status !== "IGNORED",
    ).length;
  const resetQueue = () => setCursorStack([null]);
  const applySavedView = (viewId: string) => {
    const view = savedViews.find((candidate) => candidate.id === viewId);
    if (!view) return;
    setStatusFilter(view.filters.status as typeof statusFilter);
    setSeverityFilter(view.filters.severity);
    setSortBy(view.filters.sort as typeof sortBy);
    resetQueue();
  };
  const saveCurrentView = async () => {
    const name = viewName.trim();
    if (!name) return;
    const response = await fetch(`/api/v1/organizations/${organizationId}/issues/views`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        filters: { status: statusFilter, severity: severityFilter, sort: sortBy, order: "desc" },
      }),
    });
    if (response.ok) {
      const payload = (await response.json()) as { data: SavedView };
      setSavedViews((current) => [
        ...current.filter((view) => view.id !== payload.data.id),
        payload.data,
      ]);
      setViewName("");
    }
  };
  const applyIssueAction = async (issueId: string, body: Record<string, unknown>) => {
    const response = await fetch(`/api/v1/organizations/${organizationId}/issues/${issueId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(
        `Unable to update issue (request ${response.headers.get("x-request-id") ?? "unknown"})`,
      );
    }
    const payload = (await response.json()) as { data: HealthData["issues"][number] };
    setResult((current) =>
      current
        ? {
            ...current,
            data: {
              ...current.data,
              issues: current.data.issues.map((issue) =>
                issue.id === issueId ? payload.data : issue,
              ),
            },
          }
        : current,
    );
  };
  const handleIssueAction = async (issueId: string, body: Record<string, unknown>) => {
    setActionError(null);
    setBusyIssueId(issueId);
    try {
      await applyIssueAction(issueId, body);
    } catch (cause: unknown) {
      setActionError(cause instanceof Error ? cause.message : "Unable to update issue");
    } finally {
      setBusyIssueId(null);
    }
  };
  return (
    <div className="space-y-5">
      {healthScore && (
        <section
          className="rounded-lg border border-neutral-800 p-4"
          aria-labelledby="digital-health-score-heading"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 id="digital-health-score-heading" className="font-medium">
                Digital Health Score
              </h3>
              <p className="mt-1 text-xs text-neutral-400">
                PRD-weighted score from the latest measurable monitor results and active issues.
              </p>
            </div>
            <div className="text-right">
              <p
                className={`text-3xl font-semibold ${healthScore.score === null ? "text-neutral-400" : healthScore.score >= 80 ? "text-emerald-300" : healthScore.score >= 50 ? "text-amber-300" : "text-red-300"}`}
                aria-label="Digital health score"
              >
                {healthScore.score === null ? "—" : `${healthScore.score}/100`}
              </p>
              <p className="text-xs text-neutral-500">
                {healthScore.state === "MEASURED"
                  ? "Measured"
                  : healthScore.state === "PARTIAL"
                    ? "Partial coverage"
                    : "Insufficient data"}
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm text-neutral-300">{healthScore.explanation}</p>
          <p className="mt-1 text-xs text-neutral-500">
            Coverage: {healthScore.coverageWeight}/{healthScore.totalWeight} weight · calculated{" "}
            {new Date(healthScore.calculatedAt).toLocaleString()}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {healthScore.components.map((component) => (
              <article
                key={component.category}
                className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-medium">{component.label}</h4>
                    <p className="text-xs text-neutral-500">Weight {component.weight}%</p>
                  </div>
                  <span
                    className={`text-sm font-semibold ${component.score === null ? "text-neutral-500" : component.score >= 80 ? "text-emerald-300" : component.score >= 50 ? "text-amber-300" : "text-red-300"}`}
                  >
                    {component.score === null ? "Pending" : `${component.score}/100`}
                  </span>
                </div>
                <p className="mt-2 text-xs text-neutral-400">{component.explanation}</p>
                {component.drivers.length > 0 && (
                  <div className="mt-2 border-t border-neutral-800 pt-2">
                    <p className="text-xs font-medium text-amber-200">Active evidence</p>
                    <ul className="mt-1 space-y-1 text-xs text-neutral-400">
                      {component.drivers.slice(0, 3).map((driver) => (
                        <li key={driver.id}>
                          <span className="text-amber-300">{driver.severity}</span> · {driver.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            ))}
          </div>
          {healthScoreHistory && healthScoreHistory.length > 0 && (
            <div className="mt-4 border-t border-neutral-800 pt-3">
              <p className="text-xs font-medium text-neutral-400">Score history</p>
              <ol className="mt-2 flex flex-wrap gap-2" aria-label="Digital health score history">
                {healthScoreHistory.slice(0, 8).map((snapshot) => (
                  <li
                    key={snapshot.id}
                    className="rounded border border-neutral-800 px-2 py-1 text-xs text-neutral-400"
                    title={`${new Date(snapshot.calculatedAt).toLocaleString()} · ${snapshot.coverageWeight}% coverage`}
                  >
                    {snapshot.score === null ? "—" : snapshot.score}/100
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}
      {healthScore && (
        <section
          className="rounded-lg border border-neutral-800 p-4"
          aria-labelledby="grounded-recommendations-heading"
        >
          <div>
            <h3 id="grounded-recommendations-heading" className="font-medium">
              Recommended next actions
            </h3>
            <p className="mt-1 text-xs text-neutral-400">
              Read-only actions derived from active monitor evidence and the current health score.
            </p>
          </div>
          {recommendations.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-400">No evidence-backed actions are pending.</p>
          ) : (
            <ol className="mt-3 grid gap-3 lg:grid-cols-2" aria-label="Grounded recommendations">
              {recommendations.map((recommendation) => (
                <li
                  key={recommendation.id}
                  className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-amber-200">
                        {recommendation.priority} priority
                      </p>
                      <h4 className="mt-1 text-sm font-medium">{recommendation.title}</h4>
                    </div>
                    <span className="rounded border border-emerald-900/60 px-2 py-1 text-xs text-emerald-200">
                      Evidence-backed
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-emerald-100/90">{recommendation.action}</p>
                  <p className="mt-2 text-xs text-neutral-400">{recommendation.rationale}</p>
                  {recommendation.businessImpact && (
                    <p className="mt-2 text-xs text-amber-200">
                      Business impact: {recommendation.businessImpact}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-neutral-500">
                    Source: {recommendation.source.ruleId}
                    {recommendation.source.category ? ` · ${recommendation.source.category}` : ""}
                    {recommendation.source.componentScore !== null
                      ? ` · score ${recommendation.source.componentScore}/100`
                      : " · score pending"}
                    {recommendation.confidence !== null
                      ? ` · confidence ${Math.round(recommendation.confidence * 100)}%`
                      : ""}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
      {analytics && (
        <section
          className="rounded-lg border border-neutral-800 p-4"
          aria-labelledby="issue-analytics-heading"
        >
          <h3 id="issue-analytics-heading" className="font-medium">
            Queue analytics
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-400">
            <span>
              SLA targets: acknowledge {analytics.policy.acknowledgeMinutes} min · resolve{" "}
              {analytics.policy.resolveMinutes} min
            </span>
            <a
              className="text-emerald-300 underline hover:text-emerald-200"
              href={`/api/v1/organizations/${organizationId}/issues/analytics/export?format=csv`}
              download="guardian-issue-analytics.csv"
            >
              Export CSV
            </a>
          </div>
          {canManageIssues && (
            <div className="mt-3 flex flex-wrap items-end gap-3 rounded border border-neutral-800 p-3">
              <label className="text-xs text-neutral-400">
                Acknowledge (minutes)
                <input
                  className="mt-1 block w-28 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100"
                  type="number"
                  min={1}
                  value={slaDraft.acknowledgeMinutes}
                  onChange={(event) =>
                    setSlaDraft((current) => ({
                      ...current,
                      acknowledgeMinutes: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label className="text-xs text-neutral-400">
                Resolve (minutes)
                <input
                  className="mt-1 block w-28 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100"
                  type="number"
                  min={1}
                  value={slaDraft.resolveMinutes}
                  onChange={(event) =>
                    setSlaDraft((current) => ({
                      ...current,
                      resolveMinutes: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <button
                type="button"
                className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                onClick={saveSlaPolicy}
                disabled={slaSaving}
              >
                {slaSaving ? "Saving…" : "Save SLA policy"}
              </button>
              {slaMessage && (
                <span role="status" className="text-xs text-neutral-300">
                  {slaMessage}
                </span>
              )}
            </div>
          )}
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-neutral-400">Mean acknowledge time</dt>
              <dd className="mt-1 text-lg font-semibold">
                {analytics.meanTimeToAcknowledgeMinutes === null
                  ? "—"
                  : `${analytics.meanTimeToAcknowledgeMinutes} min`}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-400">Mean resolve time</dt>
              <dd className="mt-1 text-lg font-semibold">
                {analytics.meanTimeToResolveMinutes === null
                  ? "—"
                  : `${analytics.meanTimeToResolveMinutes} min`}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-400">SLA breaches</dt>
              <dd
                className={`mt-1 text-lg font-semibold ${analytics.sla.activeBreaches > 0 ? "text-red-300" : "text-emerald-300"}`}
              >
                {analytics.sla.activeBreaches}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-400">14-day incidents</dt>
              <dd className="mt-1 text-lg font-semibold">
                {analytics.volumeTrend.reduce((sum, point) => sum + point.total, 0)}
              </dd>
            </div>
          </dl>
          <div className="mt-4" aria-label="Incident volume trend">
            <p className="text-xs text-neutral-500">Incident volume · last 14 days</p>
            <div className="mt-2 flex h-16 items-end gap-1">
              {analytics.volumeTrend.map((point) => {
                const maximum = Math.max(...analytics.volumeTrend.map((entry) => entry.total), 1);
                return (
                  <span
                    key={point.date}
                    title={`${point.date}: ${point.total}`}
                    className="min-w-1 flex-1 rounded-t bg-emerald-600/70"
                    style={{ height: `${Math.max(4, (point.total / maximum) * 100)}%` }}
                  />
                );
              })}
            </div>
          </div>
        </section>
      )}
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Healthy monitors", summary.up, "text-emerald-300"],
          ["Failing monitors", summary.down + summary.error, "text-red-300"],
          ["Active incidents", summary.activeIssues, "text-amber-300"],
          ["Recovered incidents", summary.recoveredIssues, "text-sky-300"],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
            <dt className="text-xs text-neutral-400">{label}</dt>
            <dd className={`mt-2 text-2xl font-semibold ${color}`}>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-5 lg:grid-cols-2">
        <section
          className="rounded-lg border border-neutral-800 p-4"
          aria-labelledby="recent-outcomes"
        >
          <h3 id="recent-outcomes" className="font-medium">
            Recent outcomes
          </h3>
          {recentResults.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-400">No monitor results recorded yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recentResults.slice(0, 10).map((monitorResult) => (
                <li
                  key={monitorResult.id}
                  className="flex items-center justify-between gap-4 text-sm"
                >
                  <span>
                    {monitorResult.websiteName} · {monitorResult.monitorType}
                  </span>
                  <span
                    className={monitorResult.status === "UP" ? "text-emerald-300" : "text-red-300"}
                  >
                    {monitorResult.status}
                    {monitorResult.httpStatusCode !== null
                      ? ` · HTTP ${monitorResult.httpStatusCode}`
                      : ""}
                    {monitorResult.responseTimeMs !== null
                      ? ` · ${monitorResult.responseTimeMs} ms`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          className="rounded-lg border border-neutral-800 p-4"
          aria-labelledby="response-history"
        >
          <h3 id="response-history" className="font-medium">
            Response-time history
          </h3>
          {responseHistory.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-400">No response-time history available.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {responseHistory.map((point, index) => (
                <li
                  key={`${point.checkedAt}-${index}`}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 text-xs"
                >
                  <span className="h-2 rounded bg-neutral-800">
                    <span
                      className="block h-2 rounded bg-emerald-500"
                      style={{
                        width: `${Math.max(4, (point.responseTimeMs / maxResponse) * 100)}%`,
                      }}
                    />
                  </span>
                  <span className="text-neutral-400">{point.responseTimeMs} ms</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section
        className="rounded-lg border border-neutral-800 p-4"
        aria-labelledby="incidents-heading"
      >
        <h3 id="incidents-heading" className="font-medium">
          Incident queue
        </h3>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-neutral-400">
            Status
            <select
              aria-label="Filter issues by status"
              className="ml-2 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-300"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as typeof statusFilter);
                resetQueue();
              }}
            >
              <option value="ACTIVE">Active</option>
              <option value="ALL">All</option>
              <option value="RESOLVED">Resolved</option>
              <option value="IGNORED">Ignored</option>
            </select>
          </label>
          <label className="text-xs text-neutral-400">
            Severity
            <select
              aria-label="Filter issues by severity"
              className="ml-2 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-300"
              value={severityFilter}
              onChange={(event) => {
                setSeverityFilter(event.target.value);
                resetQueue();
              }}
            >
              <option value="ALL">All severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
              <option value="INFO">Info</option>
            </select>
          </label>
          <label className="text-xs text-neutral-400">
            Sort
            <select
              aria-label="Sort issues"
              className="ml-2 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-300"
              value={sortBy}
              onChange={(event) => {
                setSortBy(event.target.value as typeof sortBy);
                resetQueue();
              }}
            >
              <option value="lastSeenAt">Recently seen</option>
              <option value="severity">Severity</option>
              <option value="status">Status</option>
            </select>
          </label>
        </div>
        {canManageIssues && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              aria-label="Load saved issue view"
              className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-300"
              defaultValue=""
              onChange={(event) => applySavedView(event.target.value)}
            >
              <option value="">Saved views</option>
              {savedViews.map((view) => (
                <option key={view.id} value={view.id}>
                  {view.name}
                </option>
              ))}
            </select>
            <input
              aria-label="Saved view name"
              className="w-40 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-300"
              placeholder="Name this view"
              value={viewName}
              onChange={(event) => setViewName(event.target.value)}
            />
            <button
              type="button"
              className="rounded border border-emerald-800 px-2 py-1 text-xs text-emerald-300 disabled:opacity-50"
              disabled={!viewName.trim()}
              onClick={() => void saveCurrentView()}
            >
              Save view
            </button>
          </div>
        )}
        <div
          className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-400"
          aria-label="Severity summary"
        >
          {(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const).map((severity) => (
            <button
              key={severity}
              type="button"
              className={`rounded-full border px-2 py-1 ${severityFilter === severity ? "border-emerald-700 text-emerald-300" : "border-neutral-800"}`}
              onClick={() => {
                setSeverityFilter((current) => (current === severity ? "ALL" : severity));
                resetQueue();
              }}
            >
              {severity}: {severityCounts(severity)}
            </button>
          ))}
        </div>
        {actionError && (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {actionError}
          </p>
        )}
        {queueLoading && <p className="mt-3 text-xs text-neutral-500">Loading queue…</p>}
        {queueIssues.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-400">No incidents detected.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-800">
            {queueIssues.map((issue) => (
              <li
                key={issue.id}
                className="flex flex-wrap items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-medium">{issue.title}</p>
                  <p className="mt-1 text-xs text-neutral-400">
                    {issue.websiteName} · {issue.summary}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs ${issue.status === "RESOLVED" ? "bg-sky-950 text-sky-300" : "bg-amber-950 text-amber-300"}`}
                >
                  {issue.status === "RESOLVED"
                    ? "Recovered"
                    : `${issue.severity} · ${issue.status}`}
                </span>
                {canManageIssues && issue.status !== "RESOLVED" && issue.status !== "IGNORED" && (
                  <div className="flex w-full flex-wrap gap-2 pt-1">
                    {issue.status === "OPEN" && (
                      <button
                        type="button"
                        disabled={busyIssueId === issue.id}
                        className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
                        onClick={() => void handleIssueAction(issue.id, { action: "ACKNOWLEDGE" })}
                      >
                        Acknowledge
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busyIssueId === issue.id}
                      className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
                      onClick={() => void handleIssueAction(issue.id, { action: "IGNORE" })}
                    >
                      Ignore
                    </button>
                    <button
                      type="button"
                      disabled={busyIssueId === issue.id}
                      className="rounded border border-emerald-800 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-950"
                      onClick={() => void handleIssueAction(issue.id, { action: "RESOLVE" })}
                    >
                      Resolve
                    </button>
                    {userId && issue.assignedToId !== userId && (
                      <button
                        type="button"
                        disabled={busyIssueId === issue.id}
                        className="rounded border border-sky-800 px-2 py-1 text-xs text-sky-300 hover:bg-sky-950"
                        onClick={() =>
                          void handleIssueAction(issue.id, {
                            action: "ASSIGN",
                            assignedToId: userId,
                          })
                        }
                      >
                        Assign to me
                      </button>
                    )}
                    {members.length > 0 && (
                      <label className="flex items-center gap-2 text-xs text-neutral-400">
                        <span className="sr-only">Assign issue</span>
                        <select
                          aria-label="Assign issue"
                          className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-300"
                          value={issue.assignedToId ?? ""}
                          disabled={busyIssueId === issue.id}
                          onChange={(event) =>
                            void handleIssueAction(issue.id, {
                              action: "ASSIGN",
                              assignedToId: event.target.value || null,
                            })
                          }
                        >
                          <option value="">Unassigned</option>
                          {members.map((member) => (
                            <option key={member.userId} value={member.userId}>
                              {member.name || member.email}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  className="text-xs text-neutral-400 underline decoration-neutral-700 underline-offset-2 hover:text-neutral-200"
                  onClick={() =>
                    setExpandedIssueId((current) => (current === issue.id ? null : issue.id))
                  }
                >
                  {expandedIssueId === issue.id ? "Hide details" : "View details"}
                </button>
                {expandedIssueId === issue.id && (
                  <div className="w-full rounded-md bg-neutral-950/60 p-3 text-xs text-neutral-400">
                    <dl className="grid gap-1 sm:grid-cols-2">
                      <div>
                        <dt className="text-neutral-500">Rule</dt>
                        <dd>{issue.ruleId ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500">Assignee</dt>
                        <dd>{issue.assignedTo?.name || issue.assignedTo?.email || "Unassigned"}</dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500">First seen</dt>
                        <dd>
                          {issue.firstSeenAt ? new Date(issue.firstSeenAt).toLocaleString() : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500">Last seen</dt>
                        <dd>{new Date(issue.lastSeenAt).toLocaleString()}</dd>
                      </div>
                    </dl>
                    {issue.technicalEvidence !== undefined && (
                      <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-neutral-900 p-2">
                        {JSON.stringify(issue.technicalEvidence, null, 2)}
                      </pre>
                    )}
                    {issue.businessImpact && (
                      <div className="mt-3 rounded-md border border-amber-900/50 bg-amber-950/20 p-3 text-sm">
                        <p className="font-medium text-amber-200">Business impact</p>
                        <p className="mt-1 text-amber-100/80">{issue.businessImpact}</p>
                      </div>
                    )}
                    {typeof issue.impactConfidence === "number" && (
                      <p className="mt-2 text-xs text-neutral-500">
                        Impact confidence: {Math.round(issue.impactConfidence * 100)}%
                      </p>
                    )}
                    {typeof issue.metadata === "object" &&
                      issue.metadata !== null &&
                      "recommendedAction" in issue.metadata &&
                      typeof (issue.metadata as { recommendedAction?: unknown })
                        .recommendedAction === "string" && (
                        <div className="mt-3 rounded-md border border-emerald-900/50 bg-emerald-950/20 p-3 text-sm">
                          <p className="font-medium text-emerald-200">Recommended action</p>
                          <p className="mt-1 text-emerald-100/80">
                            {(issue.metadata as { recommendedAction: string }).recommendedAction}
                          </p>
                        </div>
                      )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {(currentCursor !== null || queue?.nextCursor !== null) && (
          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 disabled:opacity-40"
              disabled={cursorStack.length <= 1 || queueLoading}
              onClick={() => setCursorStack((stack) => stack.slice(0, -1))}
            >
              Previous
            </button>
            <span className="text-xs text-neutral-500">Page {cursorStack.length}</span>
            <button
              type="button"
              className="rounded border border-neutral-700 px-2 py-1 text-xs text-neutral-300 disabled:opacity-40"
              disabled={!queue?.nextCursor || queueLoading}
              onClick={() =>
                queue?.nextCursor && setCursorStack((stack) => [...stack, queue.nextCursor])
              }
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
