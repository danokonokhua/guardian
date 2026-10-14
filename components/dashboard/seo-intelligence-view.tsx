"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import type { AdvancedSeoData } from "@/lib/jobs/seo-check";

export function SeoIntelligenceView({ organizationId }: { organizationId: string }) {
  const [data, setData] = useState<{
    hasAdvancedSeo: boolean;
    plan: string;
    analysis: AdvancedSeoData | null;
    searchConsole?: {
      currentClicks: number;
      impressions: number;
      averageCtrPct: number;
      averagePosition: number;
      topQueries: Array<{ query: string; clicks: number; impressions: number; position: number }>;
    } | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [querySearch, setQuerySearch] = useState("");
  const [rankFilter, setRankFilter] = useState<"ALL" | "TOP_3" | "TOP_10" | "PAGE_2">("ALL");
  const [sortField, setSortField] = useState<"position" | "clicks" | "impressions" | "query">("clicks");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/organizations/${organizationId}/seo`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load SEO intelligence.");
        return res.json();
      })
      .then((body) => {
        if (!cancelled && body.data) {
          setData(body.data);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  async function handleTriggerScan() {
    setScanning(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/v1/organizations/${organizationId}/seo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error?.message || "Failed to trigger scan.");
      }
      if (body.data?.analysis) {
        setData((prev) => (prev ? { ...prev, analysis: body.data.analysis } : prev));
        setSuccessMessage("SEO scan refreshed successfully.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to run scan.");
    } finally {
      setScanning(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-neutral-400 animate-pulse">
        Analyzing search intelligence and structured data…
      </div>
    );
  }

  // Upgrade Gate for plans without Advanced SEO (Free / Starter)
  if (data && !data.hasAdvancedSeo) {
    return (
      <div className="space-y-6">
        <GlassCard variant="elevated" glow="cyan" className="p-8 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-container/20 border border-primary-container/40 text-[#00F0FF] mb-4 text-2xl font-bold">
            ⌘
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Unlock Advanced SEO Intelligence</h2>
          <p className="text-neutral-300 text-sm max-w-xl mx-auto mb-6">
            Your current <strong>{data.plan}</strong> plan includes basic crawl hygiene. Upgrade to{" "}
            <strong>Growth</strong> or higher to unlock Open Graph previews, Schema.org structured
            data verification, heading hierarchy audits, and search snippet optimization.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left max-w-xl mx-auto mb-8">
            <div className="p-4 rounded-xl bg-surface-container/60 border border-glass-subtle-border">
              <span className="text-xs uppercase font-bold text-neutral-400">
                Included in Starter
              </span>
              <ul className="mt-2 space-y-1.5 text-xs text-neutral-300">
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> Basic indexability & robots.txt
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> Sitemap detection
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span> Title & description presence
                </li>
              </ul>
            </div>
            <div className="p-4 rounded-xl bg-primary-container/10 border border-primary-container/30">
              <span className="text-xs uppercase font-bold text-[#00F0FF]">
                Unlocked in Growth+
              </span>
              <ul className="mt-2 space-y-1.5 text-xs text-neutral-200">
                <li className="flex items-center gap-2">
                  <span className="text-[#00F0FF]">✦</span> Open Graph & Twitter social card
                  previews
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#00F0FF]">✦</span> Schema.org JSON-LD validator
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#00F0FF]">✦</span> Heading hierarchy & image alt audit
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#00F0FF]">✦</span> External canonical hijack alerts
                </li>
              </ul>
            </div>
          </div>

          <Link
            href="/billing"
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl font-semibold text-neutral-950 bg-[#00F0FF] hover:bg-[#38bdf8] transition-all shadow-[0_0_24px_rgba(0,240,255,0.4)]"
          >
            Upgrade to Growth ($29/mo)
          </Link>
        </GlassCard>
      </div>
    );
  }

  const analysis = data?.analysis;

  return (
    <div className="space-y-8">
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-sm">
          {successMessage}
        </div>
      )}

      {/* Hero Overview */}
      <GlassCard
        variant="elevated"
        glow={analysis && analysis.score >= 80 ? "emerald" : "cyan"}
        className="p-6"
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase tracking-wider font-bold text-neutral-400">
                SEO Posture
              </span>
              {analysis && (
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                    analysis.score >= 85
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : analysis.score >= 60
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                  }`}
                >
                  {analysis.score >= 85
                    ? "Optimal"
                    : analysis.score >= 60
                      ? "Needs Review"
                      : "Critical Fixes Needed"}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-white mt-1">
              Search & Social Intelligence
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              {analysis
                ? `Target: ${analysis.url} · Last inspected: ${new Date(analysis.scannedAt).toLocaleTimeString()}`
                : "Ready to scan"}
            </p>
          </div>

          <div className="flex items-center gap-6 self-stretch md:self-auto justify-between md:justify-end">
            {analysis && (
              <div className="text-center">
                <div className="text-4xl font-black text-white tracking-tight">
                  {analysis.score}
                  <span className="text-lg text-neutral-400 font-normal">/100</span>
                </div>
                <div className="text-[11px] uppercase tracking-wider text-neutral-400">
                  SEO Health Score
                </div>
              </div>
            )}

            <button
              onClick={handleTriggerScan}
              disabled={scanning}
              className="px-4 py-2.5 rounded-xl font-semibold text-xs text-neutral-950 bg-[#00F0FF] hover:bg-[#38bdf8] transition-all disabled:opacity-50"
            >
              {scanning ? "Analyzing…" : "Run Deep Scan"}
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Google Search Console & Ranking Positions */}
      {data?.searchConsole ? (
        <GlassCard variant="elevated" className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🔍</span>
                <h3 className="text-base font-bold text-white">
                  Google Organic Rankings & Search Visibility
                </h3>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Last 28 days performance from Google Search Console
              </p>
            </div>
            <div className="flex items-center gap-5 text-right">
              <div>
                <p className="text-xs text-neutral-400">Avg. Position</p>
                <p className="text-lg font-extrabold text-[#00F0FF]">
                  #{data.searchConsole.averagePosition}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-400">Clicks</p>
                <p className="text-lg font-extrabold text-white">
                  {data.searchConsole.currentClicks?.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-400">Impressions</p>
                <p className="text-lg font-extrabold text-neutral-200">
                  {data.searchConsole.impressions?.toLocaleString() ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-400">CTR</p>
                <p className="text-lg font-extrabold text-emerald-400">
                  {data.searchConsole.averageCtrPct}%
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Search & Filter Controls */}
          {Array.isArray(data.searchConsole.topQueries) && data.searchConsole.topQueries.length > 0 && (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-y border-neutral-800/80 py-3">
                <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
                  <div className="relative w-full">
                    <span className="absolute inset-y-0 left-2.5 flex items-center text-xs text-neutral-400 pointer-events-none">
                      🔎
                    </span>
                    <input
                      type="text"
                      placeholder="Filter queries..."
                      value={querySearch}
                      onChange={(e) => setQuerySearch(e.target.value)}
                      className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#00F0FF]/60"
                    />
                    {querySearch && (
                      <button
                        onClick={() => setQuerySearch("")}
                        className="absolute inset-y-0 right-2 flex items-center text-xs text-neutral-400 hover:text-white"
                        title="Clear search"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-neutral-500 mr-1 text-[11px] uppercase tracking-wider font-semibold">Tier:</span>
                  {(
                    [
                      { id: "ALL", label: "All" },
                      { id: "TOP_3", label: "Top 3 (Prime)" },
                      { id: "TOP_10", label: "Top 10 (Page 1)" },
                      { id: "PAGE_2", label: "Page 2+" },
                    ] as const
                  ).map((tier) => (
                    <button
                      key={tier.id}
                      onClick={() => setRankFilter(tier.id)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                        rankFilter === tier.id
                          ? "bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30 font-bold"
                          : "bg-neutral-900/60 text-neutral-400 hover:text-white border border-transparent"
                      }`}
                    >
                      {tier.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Top Queries Table */}
              {(() => {
                const queries = (data.searchConsole.topQueries || [])
                  .filter((q: any) => {
                    if (querySearch.trim() && !q.query.toLowerCase().includes(querySearch.toLowerCase())) {
                      return false;
                    }
                    if (rankFilter === "TOP_3") return q.position <= 3;
                    if (rankFilter === "TOP_10") return q.position > 3 && q.position <= 10;
                    if (rankFilter === "PAGE_2") return q.position > 10;
                    return true;
                  })
                  .sort((a: any, b: any) => {
                    let diff = 0;
                    if (sortField === "query") {
                      diff = a.query.localeCompare(b.query);
                    } else {
                      diff = (a[sortField] ?? 0) - (b[sortField] ?? 0);
                    }
                    return sortDirection === "asc" ? diff : -diff;
                  });

                const handleSortClick = (field: "position" | "clicks" | "impressions" | "query") => {
                  if (sortField === field) {
                    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
                  } else {
                    setSortField(field);
                    setSortDirection(field === "position" ? "asc" : "desc");
                  }
                };

                const sortIcon = (field: string) => {
                  if (sortField !== field) return "↕";
                  return sortDirection === "asc" ? "▲" : "▼";
                };

                if (queries.length === 0) {
                  return (
                    <div className="py-8 text-center text-neutral-400 text-xs">
                      No query keywords match your search or filter.{" "}
                      <button
                        onClick={() => {
                          setQuerySearch("");
                          setRankFilter("ALL");
                        }}
                        className="text-[#00F0FF] underline ml-1"
                      >
                        Reset filters
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-neutral-800 text-neutral-400 uppercase font-semibold select-none">
                          <th
                            className="pb-3 cursor-pointer hover:text-white transition"
                            onClick={() => handleSortClick("query")}
                          >
                            Search Query Keyword {sortIcon("query")}
                          </th>
                          <th
                            className="pb-3 cursor-pointer hover:text-white transition"
                            onClick={() => handleSortClick("position")}
                          >
                            Google Rank Position {sortIcon("position")}
                          </th>
                          <th
                            className="pb-3 text-right cursor-pointer hover:text-white transition"
                            onClick={() => handleSortClick("clicks")}
                          >
                            Clicks {sortIcon("clicks")}
                          </th>
                          <th
                            className="pb-3 text-right cursor-pointer hover:text-white transition"
                            onClick={() => handleSortClick("impressions")}
                          >
                            Impressions {sortIcon("impressions")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
                        {queries.map((q: any) => (
                          <tr key={q.query} className="hover:bg-neutral-900/40">
                            <td className="py-2.5 font-medium text-white">{q.query}</td>
                            <td className="py-2.5">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                                  q.position <= 3
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    : q.position <= 10
                                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                                      : "bg-neutral-800 text-neutral-400"
                                }`}
                              >
                                #{Math.round(q.position * 10) / 10}
                              </span>
                            </td>
                            <td className="py-2.5 text-right font-mono text-neutral-200">{q.clicks}</td>
                            <td className="py-2.5 text-right font-mono text-neutral-400">{q.impressions}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </>
          )}
        </GlassCard>
      ) : (
        <GlassCard variant="default" className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔍</span>
                <h3 className="text-base font-bold text-white">Google Search Console Integration</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400">
                  Not Connected
                </span>
              </div>
              <p className="text-xs text-neutral-300 max-w-xl leading-relaxed">
                Sync actual organic search queries, keyword rank positions (Top 3, Top 10), impressions, and click-through rates directly alongside Guardian’s technical SEO scans.
              </p>
              <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-neutral-400">
                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-neutral-300">
                  ✦ Live Keyword Rankings
                </span>
                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-neutral-300">
                  ✦ Click & Impression Trends
                </span>
                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-neutral-300">
                  ✦ SERP CTR Benchmarks
                </span>
              </div>
            </div>
            <Link
              href="/dashboard/integrations"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#00F0FF] text-[#0A0D14] font-bold text-xs hover:bg-[#38F4FF] transition shadow-[0_0_20px_rgba(0,240,255,0.3)] whitespace-nowrap"
            >
              Connect Search Console ↗
            </Link>
          </div>
        </GlassCard>
      )}

      {analysis && (
        <>
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <GlassCard variant="default" className="p-4">
              <span className="text-xs uppercase font-bold text-neutral-400">Title Tag</span>
              <div className="mt-2 text-lg font-bold text-white flex items-center justify-between">
                <span>{analysis.titleLength} chars</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    analysis.titleStatus === "optimal"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  {analysis.titleStatus.replace("_", " ")}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-2 line-clamp-1" title={analysis.title}>
                {analysis.title || "No title configured"}
              </p>
            </GlassCard>

            <GlassCard variant="default" className="p-4">
              <span className="text-xs uppercase font-bold text-neutral-400">Meta Description</span>
              <div className="mt-2 text-lg font-bold text-white flex items-center justify-between">
                <span>{analysis.descriptionLength} chars</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    analysis.descriptionStatus === "optimal"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  {analysis.descriptionStatus.replace("_", " ")}
                </span>
              </div>
              <p
                className="text-xs text-neutral-400 mt-2 line-clamp-1"
                title={analysis.description}
              >
                {analysis.description || "No description configured"}
              </p>
            </GlassCard>

            <GlassCard variant="default" className="p-4">
              <span className="text-xs uppercase font-bold text-neutral-400">Heading Outline</span>
              <div className="mt-2 text-lg font-bold text-white flex items-center gap-2">
                <span>H1: {analysis.headings.h1Count}</span>
                <span className="text-neutral-500">|</span>
                <span>H2: {analysis.headings.h2Count}</span>
                <span className="text-neutral-500">|</span>
                <span>H3: {analysis.headings.h3Count}</span>
              </div>
              <p className="text-xs text-neutral-400 mt-2">
                {analysis.headings.hasMultipleH1
                  ? "Multiple H1 tags"
                  : analysis.headings.hasMissingH1
                    ? "Missing primary H1"
                    : "Single primary H1 verified"}
              </p>
            </GlassCard>

            <GlassCard variant="default" className="p-4">
              <span className="text-xs uppercase font-bold text-neutral-400">
                Image Alt Coverage
              </span>
              <div className="mt-2 text-lg font-bold text-white flex items-center justify-between">
                <span>
                  {analysis.images.total > 0
                    ? `${Math.round((analysis.images.withAlt / analysis.images.total) * 100)}%`
                    : "100%"}
                </span>
                <span className="text-xs text-neutral-400">
                  {analysis.images.withAlt}/{analysis.images.total} with alt
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-2">
                {analysis.images.missingAlt === 0
                  ? "All images properly labeled"
                  : `${analysis.images.missingAlt} image(s) missing alt text`}
              </p>
            </GlassCard>
          </div>

          {/* Social Share & Structured Data Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Open Graph Card */}
            <GlassCard variant="elevated" className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white">Social Sharing (Open Graph)</h3>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                    analysis.openGraph.present
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                  }`}
                >
                  {analysis.openGraph.present ? "Tags Present" : "Missing OG Tags"}
                </span>
              </div>

              {/* Social Preview Mock */}
              <div className="rounded-xl overflow-hidden border border-glass-subtle-border bg-neutral-900/80">
                {analysis.openGraph.image ? (
                  <div className="w-full h-36 bg-neutral-800 flex items-center justify-center text-xs text-neutral-400 border-b border-glass-subtle-border overflow-hidden">
                    <img
                      src={analysis.openGraph.image}
                      alt="OG Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-full h-24 bg-neutral-800/50 flex items-center justify-center text-xs text-neutral-500 border-b border-glass-subtle-border">
                    No og:image specified
                  </div>
                )}
                <div className="p-4 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">
                    {analysis.openGraph.url || analysis.url}
                  </span>
                  <h4 className="text-sm font-bold text-white line-clamp-1">
                    {analysis.openGraph.title || analysis.title || "No social title"}
                  </h4>
                  <p className="text-xs text-neutral-400 line-clamp-2">
                    {analysis.openGraph.description ||
                      analysis.description ||
                      "No social description"}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 text-neutral-300">
                  <span>{analysis.openGraph.title ? "✓" : "✗"}</span>
                  <span className="text-neutral-400">og:title:</span>
                  <span className="truncate">
                    {analysis.openGraph.title ? "Configured" : "Missing"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-neutral-300">
                  <span>{analysis.openGraph.image ? "✓" : "✗"}</span>
                  <span className="text-neutral-400">og:image:</span>
                  <span className="truncate">
                    {analysis.openGraph.image ? "Configured" : "Missing"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-neutral-300">
                  <span>{analysis.openGraph.description ? "✓" : "✗"}</span>
                  <span className="text-neutral-400">og:desc:</span>
                  <span className="truncate">
                    {analysis.openGraph.description ? "Configured" : "Missing"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-neutral-300">
                  <span>{analysis.twitterCard.present ? "✓" : "✗"}</span>
                  <span className="text-neutral-400">twitter:card:</span>
                  <span className="truncate">{analysis.twitterCard.card || "None"}</span>
                </div>
              </div>
            </GlassCard>

            {/* Structured Data & Schema.org Card */}
            <GlassCard variant="elevated" className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white">Structured Data (Schema.org)</h3>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                    analysis.structuredData.found
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  }`}
                >
                  {analysis.structuredData.found
                    ? `${analysis.structuredData.validCount} Block(s)`
                    : "None Found"}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-surface-container/60 border border-glass-subtle-border space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Valid JSON-LD Blocks:</span>
                  <span className="font-bold text-white">{analysis.structuredData.validCount}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Syntax Parse Errors:</span>
                  <span
                    className={`font-bold ${analysis.structuredData.invalidCount > 0 ? "text-rose-400" : "text-emerald-400"}`}
                  >
                    {analysis.structuredData.invalidCount}
                  </span>
                </div>
                <div className="text-xs">
                  <span className="text-neutral-400 block mb-2">Detected Schema Types:</span>
                  {analysis.structuredData.types.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.structuredData.types.map((type) => (
                        <span
                          key={type}
                          className="px-2 py-0.5 rounded-md bg-secondary-container/20 border border-secondary-container/40 text-[#c084fc] font-mono text-[11px]"
                        >
                          @{type}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-neutral-500 text-xs italic">
                      No Schema.org types found. Consider adding Organization or WebSite JSON-LD.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 p-4 rounded-xl bg-surface-container/40 border border-glass-subtle-border text-xs text-neutral-400 space-y-1.5">
                <span className="font-bold text-neutral-300 block">Search snippet advantage</span>
                <p>
                  JSON-LD structured data helps Google understand your business identity, logo,
                  products, and contact points, unlocking rich snippets in search results.
                </p>
              </div>
            </GlassCard>
          </div>

          {/* Actionable Findings / Issues */}
          <GlassCard variant="default" className="p-6">
            <h3 className="text-base font-bold text-white mb-4">
              SEO Diagnostics & Recommendations ({analysis.issues.length})
            </h3>
            {analysis.issues.length === 0 ? (
              <div className="p-6 text-center text-sm text-emerald-400 bg-emerald-950/20 rounded-xl border border-emerald-900/40">
                ✓ No high-priority SEO hygiene issues detected. Your on-page markup is in excellent
                shape!
              </div>
            ) : (
              <div className="space-y-3">
                {analysis.issues.map((issue, idx) => (
                  <div
                    key={`${issue.ruleId}-${idx}`}
                    className="p-4 rounded-xl bg-surface-container/70 border border-glass-subtle-border flex flex-col md:flex-row items-start justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                            issue.severity === "CRITICAL" || issue.severity === "HIGH"
                              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                              : issue.severity === "MEDIUM"
                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                : "bg-neutral-800 text-neutral-300"
                          }`}
                        >
                          {issue.severity}
                        </span>
                        <h4 className="text-sm font-bold text-white">{issue.title}</h4>
                      </div>
                      <p className="text-xs text-neutral-300">{issue.summary}</p>
                      <p className="text-xs text-[#00F0FF] mt-1 font-medium">
                        💡 Fix: {issue.recommendation}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </>
      )}
    </div>
  );
}
