"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { HealthData } from "@/app/health-panel";
export function ExecutiveBriefing({
  organizationId,
  executive = false,
}: {
  organizationId: string;
  executive?: boolean;
}) {
  const [data, setData] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/organizations/${organizationId}/health`)
      .then(async (r) => {
        if (!r.ok) throw Error("Unable to load your operational briefing.");
        return r.json();
      })
      .then((body) => {
        if (!cancelled) setData(body.data);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, reload]);
  const refresh = () => {
    setData(null);
    setError(null);
    setReload((n) => n + 1);
  };
  if (error)
    return (
      <section className="setup-card" role="alert">
        <p>{error}</p>
        <button className="button-primary mt-4" onClick={refresh}>
          Retry
        </button>
      </section>
    );
  if (!data) return <p role="status">Preparing your operational summary...</p>;
  const score = data.healthScore;
  const actions = data.recommendations ?? [];
  const history = data.healthScoreHistory ?? [];
  return (
    <>
      <nav className="view-tabs" aria-label="Executive views">
        <Link href="/dashboard/executive" aria-current={executive ? "page" : undefined}>
          Executive overview
        </Link>
        <Link href="/briefings" aria-current={!executive ? "page" : undefined}>
          Operational briefing
        </Link>
        <Link href="/dashboard">Operations dashboard</Link>
      </nav>
      <section className="briefing-hero">
        <div>
          <span className="eyebrow">YOUR BUSINESS / OPERATIONAL SNAPSHOT</span>
          <h2>
            {data.summary.activeIssues > 0
              ? "Focus on what needs attention."
              : "A clearer view of your operations."}
          </h2>
          <p>{score?.explanation ?? "Health scoring is waiting for monitoring evidence."}</p>
          <span className="fine-print">
            {score?.calculatedAt
              ? `Score calculated ${new Date(score.calculatedAt).toLocaleString()}`
              : "No score calculated yet"}
          </span>
        </div>
        <button className="button-secondary compact" onClick={refresh}>
          Refresh snapshot
        </button>
      </section>
      <dl className="command-metrics">
        {[
          ["Digital health", score?.score == null ? "Pending" : `${score.score}/100`],
          ["Measured coverage", score ? `${score.coverageWeight}%` : "Pending"],
          ["Active incidents", data.summary.activeIssues],
          ["Configured monitors", data.summary.monitors],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="briefing-grid">
        <section className="setup-card">
          <span className="eyebrow">PRIORITY ACTIONS</span>
          <h2>Your next decisions</h2>
          <p>
            Recommendations derived from monitor evidence. Review the finding before deciding how to
            act.
          </p>
          {actions.length === 0 ? (
            <div className="view-empty">
              <h3>No evidence-backed actions available</h3>
              <p>Configure monitoring or review the incident queue for more context.</p>
            </div>
          ) : (
            <ol className="briefing-actions">
              {actions.map((action, index) => (
                <li key={action.id}>
                  <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <span className="eyebrow">{action.priority} PRIORITY</span>
                    <h3>{action.title}</h3>
                    <p>{action.action}</p>
                    {action.businessImpact && (
                      <p className="briefing-impact">{action.businessImpact}</p>
                    )}
                    <details>
                      <summary>Why this action?</summary>
                      <p>{action.rationale}</p>
                      <p className="fine-print">
                        Source: {action.source.ruleId}
                        {action.source.observedAt
                          ? ` / ${new Date(action.source.observedAt).toLocaleString()}`
                          : ""}
                      </p>
                    </details>
                    <Link href="/dashboard#incidents-heading" className="quiet-link">
                      Review incident queue
                    </Link>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
        <aside className="space-y-6">
          <section className="setup-card">
            <span className="eyebrow">HEALTH BREAKDOWN</span>
            <h2>Where you stand</h2>
            {score?.components.length ? (
              score.components.map((c) => (
                <div className="briefing-category" key={c.category}>
                  <div>
                    <span>{c.label}</span>
                    <strong>{c.score === null ? "Pending" : `${c.score}/100`}</strong>
                  </div>
                  {c.score !== null && (
                    <meter min={0} max={100} value={c.score} aria-label={`${c.label} score`} />
                  )}
                  <p>{c.explanation}</p>
                </div>
              ))
            ) : (
              <p>No category scores available.</p>
            )}
          </section>
          <section className="setup-card">
            <h2>Score history</h2>
            <p>Recent recorded snapshots. Coverage can change between measurements.</p>
            {history.length === 0 ? (
              <p>No history available yet.</p>
            ) : (
              <ol className="briefing-history">
                {history.slice(0, 8).map((h) => (
                  <li key={h.id}>
                    <time>{new Date(h.calculatedAt).toLocaleString()}</time>
                    <strong>{h.score === null ? "Pending" : `${h.score}/100`}</strong>
                    <span>{h.coverageWeight}% coverage</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
      <aside className="view-limit">
        <span className="eyebrow">ABOUT THIS BRIEFING</span>
        <p>
          This summary uses recorded monitoring evidence and deterministic recommendations. It does
          not generate AI advice, calculate revenue saved, or execute changes to your website.
        </p>
      </aside>
    </>
  );
}
