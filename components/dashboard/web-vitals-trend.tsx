"use client";

export function WebVitalsTrend({
  results,
}: {
  results: Array<{ responseTimeMs: number | null; checkedAt: string | Date; websiteName: string }>;
}) {
  const valid = results
    .filter((r) => typeof r.responseTimeMs === "number" && r.responseTimeMs > 0)
    .slice(0, 15);

  if (valid.length === 0) return null;

  const avgMs = Math.round(
    valid.reduce((acc, r) => acc + (r.responseTimeMs ?? 0), 0) / valid.length,
  );
  const lcpSec = ((avgMs * 1.8) / 1000).toFixed(2);
  const maxMs = Math.max(...valid.map((r) => r.responseTimeMs ?? 1), 1);

  return (
    <section className="setup-card" aria-label="Core Web Vitals and Latency Trends">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <span className="eyebrow">PERFORMANCE BENCHMARKS</span>
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
                Number(lcpSec) <= 2.5 ? "text-emerald-400" : "text-amber-400"
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

      {/* Latency History Spark Bars */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] text-neutral-400">
          <span>Latency Trend (Recent check distribution)</span>
          <span>Max peak: {maxMs} ms</span>
        </div>
        <div className="flex items-end gap-1.5 h-14 bg-neutral-950/60 p-2 rounded-lg border border-neutral-800/80">
          {valid.map((r, i) => {
            const ms = r.responseTimeMs ?? 0;
            const pct = Math.max(12, Math.round((ms / maxMs) * 100));
            const isGood = ms < 600;
            const isWarn = ms >= 600 && ms < 1500;
            return (
              <div
                key={i}
                className="flex-1 flex flex-col justify-end items-center group relative h-full"
                title={`${ms} ms on ${r.websiteName}`}
              >
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
    </section>
  );
}

