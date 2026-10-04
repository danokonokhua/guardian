"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";

interface ForecastSignal {
  metric: string;
  currentValue: number | string;
  historicalBaseline?: number | string;
  deviationPercentage?: number;
  observedAt: string;
  interpretation: string;
}

interface PredictiveForecast {
  id: string;
  websiteId: string | null;
  targetVector: string;
  riskLevel: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
  probabilityScore: number;
  predictedWindow: string;
  forecastRunwayDays: number | null;
  title: string;
  predictedImpact: string;
  underlyingSignals: ForecastSignal[];
  preventiveAction: string;
  status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";
  generatedAt: string;
}

interface PredictiveOverview {
  totalForecasts: number;
  criticalCount: number;
  highCount: number;
  moderateCount: number;
  projectedRevenueRiskUsd: number;
  forecasts: PredictiveForecast[];
}

export function PredictiveView({ organizationId }: { organizationId: string }) {
  const [overview, setOverview] = useState<PredictiveOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active filter tab
  const [filterRisk, setFilterRisk] = useState<string>("ALL");

  // Running forecast analysis state
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Expanded signals drawer
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/v1/organizations/${organizationId}/predictive`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || "Failed to load predictive overview");
      }
      const data = await res.json();
      setOverview(data.data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch predictions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [organizationId]);

  const handleRunAnalysis = async () => {
    try {
      setRunningAnalysis(true);
      setActionMessage(null);
      const res = await fetch(`/api/v1/organizations/${organizationId}/predictive`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Analysis failed");

      setActionMessage(
        `Analysis complete: ${data.data.websitesAnalyzed} websites evaluated, ${data.data.newForecastsGenerated} potential risks forecasted.`
      );
      await fetchOverview();
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setRunningAnalysis(false);
    }
  };

  const handleUpdateStatus = async (
    forecastId: string,
    status: "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED"
  ) => {
    try {
      const res = await fetch(
        `/api/v1/organizations/${organizationId}/predictive/${forecastId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      if (!res.ok) throw new Error("Failed to update forecast status");
      await fetchOverview();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filteredForecasts = (overview?.forecasts || []).filter((f) => {
    if (filterRisk === "ALL") return true;
    return f.riskLevel === filterRisk;
  });

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-glass-subtle-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🔮</span>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-on-surface">
              Predictive Intelligence & Failure Forecasting
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30">
              PRD Phase 26
            </span>
          </div>
          <p className="text-sm md:text-base text-on-surface-variant max-w-2xl">
            Forecast outages, TLS certificate cliffs, lead funnel drops, and performance regressions before downtime impacts revenue.
          </p>
        </div>

        <button
          onClick={handleRunAnalysis}
          disabled={runningAnalysis}
          className="px-5 py-2.5 rounded-xl font-bold text-xs bg-purple-600 hover:bg-purple-500 text-white shadow-lg hover:shadow-purple-500/25 transition-all flex items-center justify-center gap-2 self-start md:self-auto"
        >
          <span>{runningAnalysis ? "Modeling Telemetry..." : "⚡ Run Risk Forecasting"}</span>
        </button>
      </div>

      {/* Action Notification */}
      {actionMessage && (
        <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-sm flex items-center justify-between">
          <span>{actionMessage}</span>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs underline opacity-75 hover:opacity-100 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard className="p-5 border-l-4 border-l-rose-500 bg-surface-container/60">
          <div className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">Critical Threats</div>
          <div className="text-3xl font-black text-rose-400 mt-2">{overview?.criticalCount ?? 0}</div>
          <div className="text-xs text-on-surface-variant mt-1">Imminent &lt;24h failure runways</div>
        </GlassCard>

        <GlassCard className="p-5 border-l-4 border-l-amber-500 bg-surface-container/60">
          <div className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">Elevated Risks</div>
          <div className="text-3xl font-black text-amber-400 mt-2">{overview?.highCount ?? 0}</div>
          <div className="text-xs text-on-surface-variant mt-1">7-day projected regressions</div>
        </GlassCard>

        <GlassCard className="p-5 border-l-4 border-l-cyan-500 bg-surface-container/60">
          <div className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">Moderate Forecasts</div>
          <div className="text-3xl font-black text-cyan-400 mt-2">{overview?.moderateCount ?? 0}</div>
          <div className="text-xs text-on-surface-variant mt-1">14–30 day trend indicators</div>
        </GlassCard>

        <GlassCard className="p-5 border-l-4 border-l-purple-500 bg-surface-container/60">
          <div className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">Protected Exposure</div>
          <div className="text-3xl font-black text-purple-400 mt-2">
            ${(overview?.projectedRevenueRiskUsd ?? 0).toLocaleString()}
          </div>
          <div className="text-xs text-on-surface-variant mt-1">Estimated revenue at risk</div>
        </GlassCard>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-glass-subtle-border pb-3">
        {[
          { id: "ALL", label: `All Forecasts (${overview?.totalForecasts ?? 0})` },
          { id: "CRITICAL", label: `Critical (${overview?.criticalCount ?? 0})` },
          { id: "HIGH", label: `High Risk (${overview?.highCount ?? 0})` },
          { id: "MODERATE", label: `Moderate (${overview?.moderateCount ?? 0})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterRisk(tab.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterRisk === tab.id
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm"
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

      {/* Forecasts List */}
      {loading ? (
        <div className="py-16 text-center text-on-surface-variant animate-pulse">
          Synthesizing predictive models...
        </div>
      ) : filteredForecasts.length === 0 ? (
        <div className="py-16 text-center text-on-surface-variant border border-dashed border-glass-subtle-border rounded-2xl">
          <p className="text-base font-semibold">No active failure forecasts in this risk category.</p>
          <p className="text-xs text-on-surface-variant mt-1">
            Click &quot;⚡ Run Risk Forecasting&quot; to evaluate current telemetry slopes across your websites.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredForecasts.map((forecast) => {
            const isCritical = forecast.riskLevel === "CRITICAL";
            const isHigh = forecast.riskLevel === "HIGH";
            const isExpanded = expandedId === forecast.id;
            const probabilityPercent = Math.round(forecast.probabilityScore * 100);

            return (
              <GlassCard
                key={forecast.id}
                className={`p-6 rounded-2xl border transition-all ${
                  isCritical
                    ? "border-rose-500/40 bg-rose-950/10"
                    : isHigh
                    ? "border-amber-500/40 bg-amber-950/10"
                    : "border-purple-500/30 bg-purple-950/10"
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span
                        className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          isCritical
                            ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                            : isHigh
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                            : "bg-purple-500/20 text-purple-400 border border-purple-500/40"
                        }`}
                      >
                        {forecast.riskLevel} RISK ({probabilityPercent}%)
                      </span>

                      <span className="text-xs font-semibold text-neutral-400">
                        Window: {forecast.predictedWindow.replace(/_/g, " ")}
                      </span>

                      {forecast.forecastRunwayDays !== null && (
                        <span className="text-xs font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30">
                          ⏱️ Runway: {forecast.forecastRunwayDays} days
                        </span>
                      )}

                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider ml-auto">
                        Vector: {forecast.targetVector}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-on-surface tracking-tight">
                      {forecast.title}
                    </h3>

                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      <strong className="text-neutral-300">Projected Impact:</strong> {forecast.predictedImpact}
                    </p>

                    <div className="p-3 rounded-xl bg-surface-container/60 border border-glass-subtle-border flex items-start gap-2.5 text-xs">
                      <span className="text-purple-400 text-sm">💡</span>
                      <div>
                        <strong className="text-purple-300">Preventive Action:</strong>
                        <p className="text-neutral-300 mt-0.5">{forecast.preventiveAction}</p>
                      </div>
                    </div>

                    {/* Underlying Signals Accordion */}
                    {isExpanded && Array.isArray(forecast.underlyingSignals) && (
                      <div className="mt-4 p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-2 text-xs">
                        <div className="font-bold text-neutral-300 uppercase tracking-wider text-[11px] mb-2">
                          Telemetry & Anomaly Signals
                        </div>
                        {forecast.underlyingSignals.map((sig, i) => (
                          <div key={i} className="flex items-start gap-2 border-b border-neutral-800/80 pb-2">
                            <span className="text-cyan-400">📊</span>
                            <div>
                              <span className="font-semibold text-neutral-200">{sig.metric}:</span>{" "}
                              <span className="text-neutral-300">{sig.interpretation}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions Column */}
                  <div className="flex md:flex-col items-center gap-2 shrink-0 pt-2 md:pt-0">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : forecast.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 transition-colors"
                    >
                      {isExpanded ? "Hide Evidence" : "Inspect Signals"}
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(forecast.id, "ACKNOWLEDGED")}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-300 hover:text-purple-200 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 transition-colors"
                    >
                      Acknowledge
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(forecast.id, "RESOLVED")}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-300 hover:text-emerald-200 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 transition-colors"
                    >
                      Mark Resolved
                    </button>
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
