"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { HealthData } from "@/app/health-panel";
import { GlassCard, StatusCapsule, GlassButton } from "@/components/ui";

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
      <GlassCard glow="rose" variant="default" className="p-8 text-center" role="alert">
        <p className="text-status-outage font-medium">{error}</p>
        <GlassButton variant="primary" size="sm" className="mt-4" onClick={refresh}>
          Retry Diagnostic
        </GlassButton>
      </GlassCard>
    );

  if (!data)
    return (
      <div className="py-16 text-center space-y-3">
        <div className="inline-block w-8 h-8 rounded-full border-2 border-primary-container border-t-transparent animate-spin" />
        <p className="text-sm font-mono text-outline" role="status">
          Preparing autonomous operational summary…
        </p>
      </div>
    );

  const score = data.healthScore;
  const actions = data.recommendations ?? [];
  const history = data.healthScoreHistory ?? [];

  return (
    <div className="space-y-8">
      {/* Navigation View Tabs */}
      <nav className="flex flex-wrap items-center gap-2 p-1.5 rounded-full bg-surface-container/60 backdrop-blur-md border border-glass-subtle-border w-fit" aria-label="Executive views">
        <Link
          href="/dashboard/executive"
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
            executive
              ? "bg-primary-container text-on-primary-container shadow-[0_0_16px_rgba(0,240,255,0.3)]"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          Executive Overview
        </Link>
        <Link
          href="/briefings"
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
            !executive
              ? "bg-primary-container text-on-primary-container shadow-[0_0_16px_rgba(0,240,255,0.3)]"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          Operational Briefing
        </Link>
        <Link
          href="/dashboard"
          className="px-4 py-1.5 rounded-full text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-all"
        >
          Live Dashboard ↗
        </Link>
      </nav>

      {/* Briefing Hero */}
      <GlassCard glow="cyan" variant="elevated" className="p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-wider text-outline">
                OPERATIONAL SNAPSHOT
              </span>
              <span className="text-outline-variant">•</span>
              <StatusCapsule
                status={data.summary.activeIssues > 0 ? "outage" : "operational"}
                label={data.summary.activeIssues > 0 ? `${data.summary.activeIssues} Issues Detected` : "Systems Nominal"}
                pulse
              />
            </div>
            <h2 className="font-headline text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {data.summary.activeIssues > 0
                ? "Autonomous Vigilance: Focus Required."
                : "Continuous Operations: All Systems Stable."}
            </h2>
            <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed">
              {score?.explanation ?? "Health scoring is awaiting background telemetry samples."}
            </p>
            <p className="font-mono text-xs text-outline pt-1">
              {score?.calculatedAt
                ? `Calculated ${new Date(score.calculatedAt).toLocaleString()}`
                : "No baseline score calculated yet"}
            </p>
          </div>
          <GlassButton variant="glass" size="md" onClick={refresh} className="shrink-0 self-start sm:self-auto">
            Refresh Telemetry ⟳
          </GlassButton>
        </div>
      </GlassCard>

      {/* 4 Apple-Style Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Digital Health Index",
            value: score?.score == null ? "Pending" : `${score.score}/100`,
            status: score?.score != null && score.score >= 80 ? "operational" : "degraded",
            hint: `${score?.coverageWeight ?? 0}% model coverage`,
          },
          {
            label: "Measured Coverage",
            value: score ? `${score.coverageWeight}%` : "Pending",
            status: "operational",
            hint: "PRD weighted model",
          },
          {
            label: "Active Incidents",
            value: data.summary.activeIssues,
            status: data.summary.activeIssues === 0 ? "operational" : "outage",
            hint: "Prioritized by revenue impact",
          },
          {
            label: "Active Monitors",
            value: data.summary.monitors,
            status: "operational",
            hint: "Uptime, SSL, Forms & SEO",
          },
        ].map((metric) => (
          <GlassCard key={metric.label} variant="default" className="p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-outline truncate">
                {metric.label}
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  metric.status === "operational"
                    ? "bg-status-operational shadow-[0_0_6px_#10B981]"
                    : metric.status === "outage"
                    ? "bg-status-outage shadow-[0_0_6px_#F43F5E]"
                    : "bg-status-degraded shadow-[0_0_6px_#F59E0B]"
                }`}
              />
            </div>
            <div className="my-3">
              <span className="font-headline text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                {metric.value}
              </span>
            </div>
            <span className="font-mono text-[11px] text-outline truncate">{metric.hint}</span>
          </GlassCard>
        ))}
      </div>

      {/* Primary 2-Column Mosaic */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Priority Actions (7 cols) */}
        <section className="lg:col-span-7">
          <GlassCard glow="cyan" variant="elevated" className="p-6 sm:p-8 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="space-y-1">
                <span className="font-mono text-xs uppercase tracking-wider text-primary-container">
                  AI DECISION ENGINE
                </span>
                <h3 className="font-headline text-xl font-bold text-white">
                  Next Operational Decisions
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-surface-container font-mono text-xs text-on-surface-variant">
                {actions.length} Recommended
              </span>
            </div>
            <p className="text-sm text-on-surface-variant mb-6">
              Deterministic actions computed from live anomalies, ranked by business impact.
            </p>

            {actions.length === 0 ? (
              <div className="my-auto py-12 text-center rounded-2xl bg-surface-container/30 border border-glass-subtle-border">
                <h3 className="font-headline text-base font-semibold text-white">
                  No evidence-backed actions available
                </h3>
                <p className="text-sm text-outline mt-1 max-w-sm mx-auto">
                  Configure monitoring or review the incident queue for more context.
                </p>
              </div>
            ) : (
              <ol className="space-y-4 flex-1">
                {actions.map((action, index) => (
                  <li
                    key={action.id}
                    className="p-4 rounded-xl bg-surface-container/60 border border-glass-specular-border transition-all hover:border-primary-container/40"
                  >
                    <div className="flex items-start gap-3">
                      <span className="shrink-0 w-7 h-7 rounded-full bg-primary-container/20 border border-primary-container/30 text-primary-container font-mono font-bold text-xs flex items-center justify-center">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="font-headline font-semibold text-sm text-white">
                            {action.title}
                          </h4>
                          <span
                            className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded-full ${
                              action.priority === "HIGH"
                                ? "bg-status-outage/20 text-status-outage"
                                : "bg-status-degraded/20 text-status-degraded"
                            }`}
                          >
                            {action.priority} Priority
                          </span>
                        </div>
                        <p className="mt-2 text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                          {action.action}
                        </p>
                        {action.businessImpact && (
                          <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container text-xs font-mono text-status-degraded border border-status-degraded/20">
                            <span>Impact:</span>
                            <span className="font-semibold">{action.businessImpact}</span>
                          </div>
                        )}
                        <details className="mt-3 text-xs text-outline cursor-pointer">
                          <summary className="hover:text-primary transition-colors">
                            Technical justification & source
                          </summary>
                          <div className="mt-2 p-3 rounded-lg bg-surface-container-low/80 border border-glass-subtle-border space-y-1">
                            <p className="text-on-surface-variant">{action.rationale}</p>
                            <p className="font-mono text-[10px] text-outline pt-1">
                              Rule: {action.source.ruleId}
                              {action.source.observedAt &&
                                ` • Sample: ${new Date(action.source.observedAt).toLocaleTimeString()}`}
                            </p>
                          </div>
                        </details>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </GlassCard>
        </section>

        {/* Health Breakdown & History (5 cols) */}
        <section className="lg:col-span-5 space-y-6">
          {/* Health Breakdown */}
          <GlassCard variant="default" className="p-6">
            <span className="font-mono text-xs uppercase tracking-wider text-outline">
              COMPONENT VITALS
            </span>
            <h3 className="font-headline text-lg font-bold text-white mt-1 mb-4">
              Category Breakdown
            </h3>
            {score?.components.length ? (
              <div className="space-y-4">
                {score.components.map((c) => (
                  <div key={c.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-on-surface">{c.label}</span>
                      <span className="font-mono font-bold text-primary-fixed-dim">
                        {c.score === null ? "Pending" : `${c.score}/100`}
                      </span>
                    </div>
                    {c.score !== null && (
                      <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            c.score >= 80
                              ? "bg-status-operational"
                              : c.score >= 50
                              ? "bg-status-degraded"
                              : "bg-status-outage"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, c.score))}%` }}
                        />
                      </div>
                    )}
                    <p className="text-[11px] text-outline">{c.explanation}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-outline">No component scores recorded.</p>
            )}
          </GlassCard>

          {/* Score History */}
          <GlassCard variant="default" className="p-6">
            <h3 className="font-headline text-lg font-bold text-white mb-2">
              Telemetry History
            </h3>
            <p className="text-xs text-outline mb-4">
              Recent snapshots demonstrating coverage over time.
            </p>
            {history.length === 0 ? (
              <p className="text-xs text-outline">No historical samples recorded.</p>
            ) : (
              <ol className="space-y-2.5">
                {history.slice(0, 6).map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center justify-between text-xs p-2 rounded-lg bg-surface-container/40"
                  >
                    <time className="font-mono text-outline">
                      {new Date(h.calculatedAt).toLocaleDateString()}{" "}
                      {new Date(h.calculatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </time>
                    <span className="font-mono font-bold text-white">
                      {h.score === null ? "—" : `${h.score}/100`}
                    </span>
                    <span className="font-mono text-[10px] text-outline">
                      {h.coverageWeight}% cov
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </GlassCard>
        </section>
      </div>
    </div>
  );
}
