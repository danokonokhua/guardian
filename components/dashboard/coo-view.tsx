"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";

interface CrossDomainEvidenceSynthesis {
  websiteVector?: {
    hostname: string;
    uptimePercent: number;
    unresolvedIssuesCount: number;
  };
  revenueVector?: {
    formCaptureHealth: string;
    estimatedRevenueLossMonthly: number;
  };
  performanceVector?: {
    averageResponseTimeMs: number;
    regressionTrend: string;
  };
  seoVector?: {
    indexingHealth: string;
    metaCoveragePercent: number;
  };
  securityVector?: {
    sslRunwayDays: number | null;
    missingHeadersCount: number;
  };
  reputationVector?: {
    averageStarRating: number;
    unansweredReviewsCount: number;
  };
  competitorVector?: {
    trafficSharePercent: number;
    keywordOverlap: string;
  };
}

interface CooDirectiveItem {
  id: string;
  category: string;
  priorityTier: "P0_IMMEDIATE" | "P1_THIS_WEEK" | "P2_THIS_MONTH" | "P3_STRATEGIC";
  urgencyScore: number;
  title: string;
  executiveSummary: string;
  businessImpactUsd: number;
  effortEstimation: string;
  operationalAction: string;
  autoFixAvailable: boolean;
  status: "PENDING" | "APPROVED" | "EXECUTED" | "DISMISSED";
  crossDomainEvidence: CrossDomainEvidenceSynthesis;
  approvedAt: string | null;
  executedAt: string | null;
  executionResult?: any;
}

interface CooOverview {
  totalDirectives: number;
  p0ImmediateCount: number;
  p1ThisWeekCount: number;
  totalOpportunityValueUsd: number;
  executiveBriefingSummary: string;
  directives: CooDirectiveItem[];
}

export function CooView({ organizationId }: { organizationId: string }) {
  const [overview, setOverview] = useState<CooOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active filter tab
  const [filterTier, setFilterTier] = useState<string>("ALL");

  // Executive synthesis running state
  const [generating, setGenerating] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Expanded evidence drawer
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Executing directive ID
  const [executingId, setExecutingId] = useState<string | null>(null);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/v1/organizations/${organizationId}/coo`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || "Failed to load AI COO overview");
      }
      const data = await res.json();
      setOverview(data.data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch AI COO briefings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [organizationId]);

  const handleGenerateDirectives = async () => {
    try {
      setGenerating(true);
      setActionNotice(null);
      const res = await fetch(`/api/v1/organizations/${organizationId}/coo`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Synthesis failed");

      setActionNotice(
        `AI COO Synthesis complete: ${data.data.websitesEvaluated} web properties synthesized across all 8 vectors, yielding ${data.data.directivesGenerated} prioritized directives.`
      );
      await fetchOverview();
    } catch (err: any) {
      setActionNotice(`Error: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleExecuteAction = async (
    directiveId: string,
    action: "APPROVE" | "EXECUTE" | "DISMISS"
  ) => {
    try {
      setExecutingId(directiveId);
      const res = await fetch(
        `/api/v1/organizations/${organizationId}/coo/${directiveId}/execute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Action failed");

      setActionNotice(
        action === "EXECUTE"
          ? "Directive executed successfully via Guardian Autonomous Ops engine."
          : `Directive status updated to ${action}.`
      );
      await fetchOverview();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setExecutingId(null);
    }
  };

  const filteredDirectives = (overview?.directives || []).filter((d) => {
    if (filterTier === "ALL") return true;
    return d.priorityTier === filterTier;
  });

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-glass-subtle-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🤖</span>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-on-surface">
              AI COO Executive Operations Hub
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              PRD Phase 27 (Final Phase)
            </span>
          </div>
          <p className="text-sm md:text-base text-on-surface-variant max-w-2xl">
            Autonomous Chief Operating Officer synthesizing cross-domain telemetry into executive revenue roadmaps and 1-click strategic directives.
          </p>
        </div>

        <button
          onClick={handleGenerateDirectives}
          disabled={generating}
          className="px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg hover:shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 self-start md:self-auto"
        >
          <span>{generating ? "Synthesizing Operations..." : "⚡ Synthesize Executive Directives"}</span>
        </button>
      </div>

      {/* Executive Briefing Callout */}
      {overview?.executiveBriefingSummary && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/20 via-neutral-900 to-cyan-950/20 border border-emerald-500/30 shadow-xl flex items-start gap-3.5">
          <span className="text-2xl">📋</span>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Executive Briefing & Synthesis
            </div>
            <p className="text-sm text-neutral-200 mt-1 font-medium leading-relaxed">
              {overview.executiveBriefingSummary}
            </p>
          </div>
        </div>
      )}

      {/* Action Notice */}
      {actionNotice && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center justify-between">
          <span>{actionNotice}</span>
          <button
            onClick={() => setActionNotice(null)}
            className="text-xs underline opacity-75 hover:opacity-100 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard className="p-5 border-l-4 border-l-rose-500 bg-surface-container/60">
          <div className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">P0 Immediate Directives</div>
          <div className="text-3xl font-black text-rose-400 mt-2">{overview?.p0ImmediateCount ?? 0}</div>
          <div className="text-xs text-on-surface-variant mt-1">Requires immediate authorization</div>
        </GlassCard>

        <GlassCard className="p-5 border-l-4 border-l-amber-500 bg-surface-container/60">
          <div className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">P1 Weekly Actions</div>
          <div className="text-3xl font-black text-amber-400 mt-2">{overview?.p1ThisWeekCount ?? 0}</div>
          <div className="text-xs text-on-surface-variant mt-1">Scheduled for this sprint</div>
        </GlassCard>

        <GlassCard className="p-5 border-l-4 border-l-emerald-500 bg-surface-container/60">
          <div className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">Opportunity Value</div>
          <div className="text-3xl font-black text-emerald-400 mt-2">
            ${(overview?.totalOpportunityValueUsd ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-on-surface-variant mt-1">Estimated business upside</div>
        </GlassCard>

        <GlassCard className="p-5 border-l-4 border-l-cyan-500 bg-surface-container/60">
          <div className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">Active Directives</div>
          <div className="text-3xl font-black text-cyan-400 mt-2">{overview?.totalDirectives ?? 0}</div>
          <div className="text-xs text-on-surface-variant mt-1">Multi-vector synthesized actions</div>
        </GlassCard>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-glass-subtle-border pb-3">
        {[
          { id: "ALL", label: `All Directives (${overview?.totalDirectives ?? 0})` },
          { id: "P0_IMMEDIATE", label: `P0 Immediate (${overview?.p0ImmediateCount ?? 0})` },
          { id: "P1_THIS_WEEK", label: `P1 This Week (${overview?.p1ThisWeekCount ?? 0})` },
          { id: "P2_THIS_MONTH", label: "P2 This Month" },
          { id: "P3_STRATEGIC", label: "P3 Strategic" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterTier(tab.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterTier === tab.id
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Directives List */}
      {loading ? (
        <div className="py-16 text-center text-on-surface-variant animate-pulse">
          Synthesizing AI COO executive directives...
        </div>
      ) : filteredDirectives.length === 0 ? (
        <div className="py-16 text-center text-on-surface-variant border border-dashed border-glass-subtle-border rounded-2xl">
          <p className="text-base font-semibold">No active COO directives in this priority tier.</p>
          <p className="text-xs text-on-surface-variant mt-1">
            Click &quot;⚡ Synthesize Executive Directives&quot; to formulate prioritized directives across your properties.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDirectives.map((directive) => {
            const isP0 = directive.priorityTier === "P0_IMMEDIATE";
            const isP1 = directive.priorityTier === "P1_THIS_WEEK";
            const isExecuted = directive.status === "EXECUTED";
            const isApproved = directive.status === "APPROVED";
            const isExpanded = expandedId === directive.id;
            const isBusy = executingId === directive.id;

            return (
              <GlassCard
                key={directive.id}
                className={`p-6 rounded-2xl border transition-all ${
                  isExecuted
                    ? "border-emerald-500/30 bg-emerald-950/10 opacity-80"
                    : isP0
                    ? "border-rose-500/40 bg-rose-950/10"
                    : isP1
                    ? "border-amber-500/40 bg-amber-950/10"
                    : "border-neutral-700 bg-neutral-900/40"
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span
                        className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          isExecuted
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                            : isP0
                            ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                            : isP1
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                            : "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                        }`}
                      >
                        {directive.priorityTier.replace(/_/g, " ")} (Urgency: {directive.urgencyScore}/100)
                      </span>

                      <span className="text-xs font-bold text-emerald-300 bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/30">
                        💰 Impact: +${directive.businessImpactUsd.toLocaleString()}
                      </span>

                      <span className="text-xs font-semibold text-neutral-400">
                        Effort: {directive.effortEstimation.replace(/_/g, " ")}
                      </span>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ml-auto ${
                          isExecuted
                            ? "bg-emerald-500 text-black"
                            : isApproved
                            ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                            : "bg-neutral-800 text-neutral-400"
                        }`}
                      >
                        {directive.status}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-on-surface tracking-tight">
                      {directive.title}
                    </h3>

                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      <strong className="text-neutral-300">Executive Justification:</strong> {directive.executiveSummary}
                    </p>

                    <div className="p-3 rounded-xl bg-surface-container/60 border border-glass-subtle-border flex items-start gap-2.5 text-xs">
                      <span className="text-emerald-400 text-sm">🎯</span>
                      <div>
                        <strong className="text-emerald-300">Operational Directive:</strong>
                        <p className="text-neutral-300 mt-0.5">{directive.operationalAction}</p>
                      </div>
                    </div>

                    {/* Cross-Domain Evidence Accordion */}
                    {isExpanded && directive.crossDomainEvidence && (
                      <div className="mt-4 p-4 rounded-xl bg-neutral-900/90 border border-neutral-800 space-y-2 text-xs">
                        <div className="font-bold text-neutral-300 uppercase tracking-wider text-[11px] mb-2">
                          Cross-Domain Telemetry Synthesis Evidence
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-neutral-300">
                          {directive.crossDomainEvidence.websiteVector && (
                            <div className="p-2.5 rounded bg-neutral-800/60 border border-neutral-700/60">
                              <span className="font-bold text-cyan-400">🌐 Website:</span>{" "}
                              {directive.crossDomainEvidence.websiteVector.uptimePercent}% Uptime,{" "}
                              {directive.crossDomainEvidence.websiteVector.unresolvedIssuesCount} Open Issues
                            </div>
                          )}
                          {directive.crossDomainEvidence.revenueVector && (
                            <div className="p-2.5 rounded bg-neutral-800/60 border border-neutral-700/60">
                              <span className="font-bold text-emerald-400">💰 Revenue:</span>{" "}
                              {directive.crossDomainEvidence.revenueVector.formCaptureHealth} Form Health,{" "}
                              ${directive.crossDomainEvidence.revenueVector.estimatedRevenueLossMonthly}/mo Risk
                            </div>
                          )}
                          {directive.crossDomainEvidence.performanceVector && (
                            <div className="p-2.5 rounded bg-neutral-800/60 border border-neutral-700/60">
                              <span className="font-bold text-amber-400">⚡ Performance:</span>{" "}
                              {directive.crossDomainEvidence.performanceVector.averageResponseTimeMs}ms TTFB
                            </div>
                          )}
                          {directive.crossDomainEvidence.seoVector && (
                            <div className="p-2.5 rounded bg-neutral-800/60 border border-neutral-700/60">
                              <span className="font-bold text-purple-400">🔍 SEO:</span>{" "}
                              {directive.crossDomainEvidence.seoVector.metaCoveragePercent}% Meta Coverage
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions Column */}
                  <div className="flex md:flex-col items-center gap-2 shrink-0 pt-2 md:pt-0">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : directive.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 transition-colors"
                    >
                      {isExpanded ? "Hide Evidence" : "Synthesized Evidence"}
                    </button>

                    {!isExecuted && (
                      <>
                        {!isApproved && (
                          <button
                            onClick={() => handleExecuteAction(directive.id, "APPROVE")}
                            disabled={isBusy}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-cyan-300 hover:text-cyan-200 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 transition-colors"
                          >
                            Authorize
                          </button>
                        )}
                        <button
                          onClick={() => handleExecuteAction(directive.id, "EXECUTE")}
                          disabled={isBusy}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md transition-all flex items-center gap-1"
                        >
                          <span>{isBusy ? "Executing..." : "⚡ Execute Directive"}</span>
                        </button>
                        <button
                          onClick={() => handleExecuteAction(directive.id, "DISMISS")}
                          disabled={isBusy}
                          className="text-[11px] text-neutral-400 hover:text-rose-400 transition-colors underline pt-1"
                        >
                          Dismiss
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
