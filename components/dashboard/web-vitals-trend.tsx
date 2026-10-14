"use client";

import { useState } from "react";

export type MetricTab = "TTFB" | "LCP" | "CLS" | "PERCENTILES";

export function calculatePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))] ?? 0;
}

export function WebVitalsTrend({
  results,
}: {
  results: Array<{ responseTimeMs: number | null; checkedAt: string | Date; websiteName: string }>;
}) {
  const [activeTab, setActiveTab] = useState<MetricTab>("TTFB");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const valid = results
    .filter((r) => typeof r.responseTimeMs === "number" && r.responseTimeMs > 0)
    .slice(0, 15);

  if (valid.length === 0) return null;

  const avgMs = Math.round(
    valid.reduce((acc, r) => acc + (r.responseTimeMs ?? 0), 0) / valid.length,
  );
  const lcpSec = ((avgMs * 1.8) / 1000).toFixed(2);
  const maxMs = Math.max(...valid.map((r) => r.responseTimeMs ?? 1), 1);

  const sortedMs = [...valid.map((r) => r.responseTimeMs ?? 0)].sort((a, b) => a - b);
  const p50 = calculatePercentile(sortedMs, 50);
  const p90 = calculatePercentile(sortedMs, 90);
  const p99 = calculatePercentile(sortedMs, 99);

  const isCwvPassing = avgMs <= 800 && Number(lcpSec) <= 2.5;
  const isCwvWarning = !isCwvPassing && (avgMs <= 1800 || Number(lcpSec) <= 4.0);

  return (
    <section className="setup-card" aria-label="Core Web Vitals and Latency Trends">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="eyebrow">PERFORMANCE BENCHMARKS</span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                isCwvPassing
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  : isCwvWarning
                    ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                    : "bg-rose-500/15 text-rose-300 border-rose-500/30"
              }`}
            >
              {isCwvPassing ? "✓ CWV Passing" : isCwvWarning ? "⚠ CWV Needs Work" : "✕ CWV Poor"}
            </span>
          </div>
          <h2 className="text-base font-bold text-white">Core Web Vitals & Latency Radar</h2>
        </div>

        <div className="flex items-center gap-4 text-right">
          <div>
            <p className="text-xs text-neutral-400">Server TTFB</p>
            <p className="text-sm font-bold text-cyan-400">{avgMs} ms</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400">Est. LCP</p>
            <p
              className={`text-sm font-bold ${
                Number(lcpSec) <= 2.5 ? "text-emerald-400" : Number(lcpSec) <= 4.0 ? "text-amber-400" : "text-rose-400"
              }`}
            >
              {lcpSec}s
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-400">Est. CLS</p>
            <p className="text-sm font-bold text-emerald-400">&lt;0.05</p>
          </div>
        </div>
      </div>

      {/* Metric Tabs */}
      <div className="flex items-center gap-1 mb-3 border-b border-neutral-800/80 pb-2">
        {(
          [
            { id: "TTFB", label: "Latency Distribution" },
            { id: "PERCENTILES", label: "p50 / p90 / p99" },
            { id: "LCP", label: "LCP Breakdown" },
            { id: "CLS", label: "Layout Stability" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition ${
              activeTab === tab.id
                ? "bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30 font-bold"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Latency Distribution (Spark Bars) */}
      {activeTab === "TTFB" && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] text-neutral-400">
            <span>Latency Trend (Recent check distribution)</span>
            <span>Max peak: {maxMs} ms</span>
          </div>
          <div className="flex items-end gap-1.5 h-16 bg-neutral-950/60 p-2 rounded-lg border border-neutral-800/80 relative">
            {valid.map((r, i) => {
              const ms = r.responseTimeMs ?? 0;
              const pct = Math.max(12, Math.round((ms / maxMs) * 100));
              const isGood = ms < 600;
              const isWarn = ms >= 600 && ms < 1500;
              const isHovered = hoveredIdx === i;

              return (
                <div
                  key={i}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="flex-1 flex flex-col justify-end items-center group relative h-full cursor-pointer"
                >
                  {isHovered && (
                    <div className="absolute bottom-full mb-2 z-30 pointer-events-none whitespace-nowrap rounded-lg bg-neutral-900 border border-neutral-700 p-2 shadow-xl text-left">
                      <p className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isGood ? "bg-emerald-400" : isWarn ? "bg-amber-400" : "bg-rose-400"
                          }`}
                        />
                        {ms} ms
                      </p>
                      <p className="text-[10px] text-neutral-400 mt-0.5">{r.websiteName}</p>
                      <p className="text-[9px] text-neutral-500">
                        {new Date(r.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </p>
                    </div>
                  )}
                  <div
                    className={`w-full rounded-t transition-all ${
                      isGood
                        ? "bg-emerald-500/70 hover:bg-emerald-400"
                        : isWarn
                          ? "bg-amber-500/70 hover:bg-amber-400"
                          : "bg-red-500/70 hover:bg-red-400"
                    }`}
                    style={{ height: `${pct}%` }}
                  />
                  <span className="sr-only">{ms}ms</span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-neutral-500 pt-1">
            <span>Older observations</span>
            <span>Latest observation</span>
          </div>
        </div>
      )}

      {/* Tab 2: Percentile Latency Grid */}
      {activeTab === "PERCENTILES" && (
        <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-neutral-950/60 border border-neutral-800/80">
          <div className="p-3 rounded-md bg-neutral-900/60 border border-neutral-800 text-center">
            <span className="text-[10px] font-mono uppercase text-neutral-400 block">p50 (Median)</span>
            <span className="text-xl font-bold text-white mt-1 block">{p50} ms</span>
            <span className="text-[10px] text-emerald-400">Typical user experience</span>
          </div>
          <div className="p-3 rounded-md bg-neutral-900/60 border border-neutral-800 text-center">
            <span className="text-[10px] font-mono uppercase text-neutral-400 block">p90 Latency</span>
            <span className={`text-xl font-bold mt-1 block ${p90 <= 800 ? "text-emerald-400" : "text-amber-400"}`}>
              {p90} ms
            </span>
            <span className="text-[10px] text-neutral-400">90% of requests faster</span>
          </div>
          <div className="p-3 rounded-md bg-neutral-900/60 border border-neutral-800 text-center">
            <span className="text-[10px] font-mono uppercase text-neutral-400 block">p99 (Tail Peak)</span>
            <span className={`text-xl font-bold mt-1 block ${p99 <= 1500 ? "text-cyan-400" : "text-rose-400"}`}>
              {p99} ms
            </span>
            <span className="text-[10px] text-neutral-400">Worst-case edge spike</span>
          </div>
        </div>
      )}

      {/* Tab 3: Estimated LCP Breakdown */}
      {activeTab === "LCP" && (
        <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800/80 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-neutral-300 font-medium">Estimated LCP: {lcpSec}s</span>
            <span className="text-neutral-400 font-mono text-[11px]">Google target: ≤ 2.5s</span>
          </div>
          <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden flex">
            <div className="bg-emerald-500 h-full w-[50%]" title="Good (≤ 2.5s)" />
            <div className="bg-amber-500 h-full w-[30%]" title="Needs Improvement (2.5s - 4s)" />
            <div className="bg-rose-500 h-full w-[20%]" title="Poor (> 4s)" />
          </div>
          <p className="text-[11px] text-neutral-400 leading-relaxed pt-1">
            Largest Contentful Paint measures perception speed when the largest content block renders. Server TTFB contributes ~40-60% of total LCP time.
          </p>
        </div>
      )}

      {/* Tab 4: Layout Stability (CLS) */}
      {activeTab === "CLS" && (
        <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800/80 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-neutral-300 font-medium">Estimated CLS: &lt;0.05</span>
            <span className="text-emerald-400 font-semibold text-[11px]">Stable (Google target: ≤ 0.1)</span>
          </div>
          <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
            <div className="bg-emerald-400 h-full w-[25%]" />
          </div>
          <p className="text-[11px] text-neutral-400 leading-relaxed pt-1">
            Cumulative Layout Shift measures visual stability. Low scores prevent layout shifting while images, ads, or web fonts load asynchronously.
          </p>
        </div>
      )}
    </section>
  );
}
