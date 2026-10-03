"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";

interface CompetitorSnapshot {
  id: string;
  snapshotDate: string;
  httpStatus: number | null;
  responseTimeMs: number | null;
  pageTitle: string | null;
  metaDescription: string | null;
  h1: string | null;
  detectedOffer: string | null;
  seoScore: number | null;
  hasChanges: boolean;
  changeSummary: string | null;
}

interface CompetitorItem {
  id: string;
  name: string;
  domain: string;
  targetUrl: string;
  status: string;
  lastCheckedAt: string | null;
  latestSnapshot: CompetitorSnapshot | null;
}

interface ComparisonData {
  websiteId: string | null;
  websiteHostname: string | null;
  websiteSpeedMs: number | null;
  websiteSeoScore: number | null;
  competitorsCount: number;
  activeOffersCount: number;
  avgCompetitorSpeedMs: number | null;
  competitors: CompetitorItem[];
}

export function CompetitorsView({ organizationId }: { organizationId: string }) {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Add Competitor Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [addSandbox, setAddSandbox] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/v1/organizations/${organizationId}/competitors`)
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error?.message || "Failed to load competitor intelligence.");
        }
        return r.json();
      })
      .then((body) => {
        if (!cancelled && body.data) {
          setData(body.data.comparison);
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
  }, [organizationId, reloadTrigger]);

  async function handleAddCompetitor(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newUrl.trim()) return;

    setIsAdding(true);
    setAddError(null);

    try {
      const res = await fetch(`/api/v1/organizations/${organizationId}/competitors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          urlOrDomain: newUrl.trim(),
          isSandbox: addSandbox,
        }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.message || "Failed to add competitor.");

      setShowAddModal(false);
      setNewName("");
      setNewUrl("");
      setReloadTrigger((v) => v + 1);
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setIsAdding(false);
    }
  }

  async function handleProbeCompetitor(competitorId: string) {
    setRefreshingId(competitorId);
    try {
      const res = await fetch(
        `/api/v1/organizations/${organizationId}/competitors/${competitorId}/sync`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isSandbox: true }),
        },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.message || "Probe failed.");
      setReloadTrigger((v) => v + 1);
    } catch (err: any) {
      alert(`Could not refresh competitor: ${err.message}`);
    } finally {
      setRefreshingId(null);
    }
  }

  async function handleDeleteCompetitor(competitorId: string, name: string) {
    if (!confirm(`Are you sure you want to remove ${name} from competitor tracking?`)) {
      return;
    }

    try {
      const res = await fetch(
        `/api/v1/organizations/${organizationId}/competitors/${competitorId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to delete competitor.");
      setReloadTrigger((v) => v + 1);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleBulkSync() {
    setIsBulkSyncing(true);
    try {
      const res = await fetch(`/api/v1/organizations/${organizationId}/competitors/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSandbox: true }),
      });
      if (!res.ok) throw new Error("Bulk sync failed.");
      setReloadTrigger((v) => v + 1);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsBulkSyncing(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-on-surface-variant animate-pulse">
          <div className="h-4 w-4 rounded-full border-2 border-primary-container border-t-transparent animate-spin" />
          <span>Gathering competitor signals...</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <GlassCard className="p-8 text-center" glow="rose">
        <h3 className="text-lg font-semibold text-status-outage">Competitor Intelligence Error</h3>
        <p className="mt-2 text-sm text-on-surface-variant">{error}</p>
        <button
          onClick={() => setReloadTrigger((v) => v + 1)}
          className="mt-4 px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg bg-surface-container-high border border-glass-specular-border hover:bg-surface-container-highest transition-colors"
        >
          Retry
        </button>
      </GlassCard>
    );
  }

  const competitors = data?.competitors || [];
  const yourSpeed = data?.websiteSpeedMs ?? 280;
  const avgCompetitorSpeed = data?.avgCompetitorSpeedMs;

  return (
    <div className="space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-on-surface">
            Competitor Intelligence & Positioning
          </h2>
          <p className="text-sm text-on-surface-variant">
            Monitor competitive digital posture, headline copy changes, speed advantages, and promotional campaigns.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBulkSync}
            disabled={isBulkSyncing || competitors.length === 0}
            className="flex items-center gap-2 rounded-xl border border-glass-specular-border bg-surface-container-low/75 px-4 py-2.5 text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50"
          >
            {isBulkSyncing ? (
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-container border-t-transparent" />
            ) : (
              <span>↻</span>
            )}
            Probe All Active
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="rounded-xl bg-primary-container px-4 py-2.5 text-xs font-semibold text-on-primary-container shadow-md shadow-primary-container/20 hover:opacity-90 transition-opacity"
          >
            + Add Competitor
          </button>
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GlassCard className="p-5" glow="cyan">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>Competitors Monitored</span>
            <span className="font-mono text-cyan-400">TARGETS</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-on-surface">
              {data?.competitorsCount ?? 0}
            </span>
            <span className="text-xs text-on-surface-variant">active domains</span>
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">
            Tracking title, H1 headlines & Core Web Vitals speed
          </p>
        </GlassCard>

        <GlassCard className="p-5" glow="violet">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>Detected Offers & Campaigns</span>
            <span className="font-mono text-purple-400">OFFERS</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-on-surface">
              {data?.activeOffersCount ?? 0}
            </span>
            <span className="text-xs text-on-surface-variant">campaigns</span>
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">
            Active landing page discounts or free trial offers
          </p>
        </GlassCard>

        <GlassCard className="p-5" glow="emerald">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>Speed Benchmark</span>
            <span className="font-mono text-emerald-400">LATENCY</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-on-surface">
              {avgCompetitorSpeed ? `${avgCompetitorSpeed}ms` : "—"}
            </span>
            <span className="text-xs text-on-surface-variant">
              vs {yourSpeed}ms your site
            </span>
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">
            {avgCompetitorSpeed && avgCompetitorSpeed < yourSpeed ? (
              <span className="text-amber-400">Competitors loading faster on average</span>
            ) : (
              <span className="text-emerald-400">Your website maintains speed advantage</span>
            )}
          </p>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>SEO Completeness</span>
            <span className="font-mono text-blue-400">STRUCTURE</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-on-surface">
              {data?.websiteSeoScore ?? 88}
              <span className="text-base text-on-surface-variant font-normal">/100</span>
            </span>
            <span className="text-xs text-emerald-400">Baseline</span>
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">
            Title, description, and semantic header coverage
          </p>
        </GlassCard>
      </div>

      {/* Head-to-Head Comparison Table */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-on-surface">Head-to-Head Digital Posture</h3>
            <p className="text-xs text-on-surface-variant">
              Direct positioning comparison against monitored competitors
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-surface-container-high border border-glass-specular-border text-on-surface-variant">
            {competitors.length} Monitored
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-glass-specular-border text-on-surface-variant">
                <th className="pb-3 font-semibold uppercase tracking-wider">Business / Domain</th>
                <th className="pb-3 font-semibold uppercase tracking-wider">Response Speed</th>
                <th className="pb-3 font-semibold uppercase tracking-wider">SEO Score</th>
                <th className="pb-3 font-semibold uppercase tracking-wider">Landing Page Headline (H1)</th>
                <th className="pb-3 font-semibold uppercase tracking-wider">Active Promotional Offer</th>
                <th className="pb-3 font-semibold uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-specular-border">
              {/* Customer Row */}
              <tr className="bg-primary-container/5 hover:bg-primary-container/10 transition-colors">
                <td className="py-4 font-medium text-on-surface">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-cyan-400" />
                    <div>
                      <strong className="text-sm text-cyan-300">Your Website</strong>
                      <p className="text-[11px] text-on-surface-variant">
                        {data?.websiteHostname || "Registered Domain"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-4">
                  <span className="font-mono font-medium text-on-surface">{yourSpeed}ms</span>
                </td>
                <td className="py-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {data?.websiteSeoScore ?? 88} / 100
                  </span>
                </td>
                <td className="py-4 max-w-xs truncate text-on-surface">
                  Primary Brand Positioning
                </td>
                <td className="py-4">
                  <span className="text-on-surface-variant italic">Standard pricing</span>
                </td>
                <td className="py-4 text-right">
                  <span className="text-[11px] text-cyan-400 font-semibold uppercase">You</span>
                </td>
              </tr>

              {/* Competitors Rows */}
              {competitors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                    <p className="text-sm">No competitors monitored yet.</p>
                    <p className="text-xs mt-1">
                      Click <strong className="text-on-surface">"+ Add Competitor"</strong> to start tracking competitive signals.
                    </p>
                  </td>
                </tr>
              ) : (
                competitors.map((c) => {
                  const s = c.latestSnapshot;
                  const speed = s?.responseTimeMs ?? null;
                  const isFaster = speed !== null && speed < yourSpeed;
                  const isBusy = refreshingId === c.id;

                  return (
                    <tr key={c.id} className="hover:bg-surface-container-high/40 transition-colors">
                      <td className="py-4">
                        <div>
                          <strong className="text-sm text-on-surface">{c.name}</strong>
                          <p className="text-[11px] text-on-surface-variant font-mono">{c.domain}</p>
                        </div>
                      </td>
                      <td className="py-4 font-mono">
                        {speed ? (
                          <div className="flex items-center gap-2">
                            <span>{speed}ms</span>
                            {isFaster ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Faster
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Slower
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-on-surface-variant">—</span>
                        )}
                      </td>
                      <td className="py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-surface-container-high text-on-surface border border-glass-specular-border">
                          {s?.seoScore ?? 70} / 100
                        </span>
                      </td>
                      <td className="py-4 max-w-xs truncate text-on-surface" title={s?.h1 || undefined}>
                        {s?.h1 || <span className="text-on-surface-variant italic">No H1 detected</span>}
                      </td>
                      <td className="py-4">
                        {s?.detectedOffer ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            🏷️ {s.detectedOffer}
                          </span>
                        ) : (
                          <span className="text-on-surface-variant italic">None detected</span>
                        )}
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleProbeCompetitor(c.id)}
                            disabled={isBusy}
                            className="px-2.5 py-1 rounded-lg bg-surface-container-high border border-glass-specular-border text-[11px] font-medium text-on-surface hover:bg-surface-container-highest transition-colors disabled:opacity-50"
                            title="Probe competitor now"
                          >
                            {isBusy ? "Probing..." : "Probe"}
                          </button>
                          <button
                            onClick={() => handleDeleteCompetitor(c.id, c.name)}
                            className="px-2 py-1 rounded-lg text-[11px] text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Remove competitor"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Competitive Movements & Shifts Timeline */}
      <GlassCard className="p-6">
        <h3 className="text-base font-semibold text-on-surface mb-2">Competitive Shifts & Alert Feed</h3>
        <p className="text-xs text-on-surface-variant mb-6">
          Recent modifications to competitor landing pages, promotional campaigns, and SEO headlines
        </p>

        {competitors.filter((c) => c.latestSnapshot?.changeSummary).length === 0 ? (
          <p className="text-xs text-on-surface-variant py-4 italic">
            No competitive shifts detected in the latest scans. Run a probe or monitor for shifts.
          </p>
        ) : (
          <div className="space-y-4">
            {competitors
              .filter((c) => c.latestSnapshot)
              .map((c) => {
                const s = c.latestSnapshot!;
                return (
                  <div
                    key={c.id}
                    className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 p-4 rounded-xl bg-surface-container-low/60 border border-glass-specular-border"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <strong className="text-sm text-on-surface">{c.name}</strong>
                        <span className="text-xs text-on-surface-variant font-mono">({c.domain})</span>
                        {s.hasChanges && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/25">
                            SHIFT DETECTED
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-on-surface">
                        {s.changeSummary || "Initial baseline captured."}
                      </p>
                      {s.pageTitle && (
                        <p className="text-[11px] text-on-surface-variant">
                          <span className="font-semibold">Current Title:</span> {s.pageTitle}
                        </p>
                      )}
                    </div>
                    <span className="text-[11px] text-on-surface-variant font-mono whitespace-nowrap">
                      {new Date(s.snapshotDate).toLocaleDateString()}
                    </span>
                  </div>
                );
              })}
          </div>
        )}
      </GlassCard>

      {/* Add Competitor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <GlassCard className="w-full max-w-md p-6" glow="cyan">
            <h3 className="text-lg font-bold text-on-surface">Add Monitored Competitor</h3>
            <p className="mt-1 text-xs text-on-surface-variant">
              Guardian safely inspects public landing page headers, SEO structure, speed, and promotional offers.
            </p>

            {addError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                {addError}
              </div>
            )}

            <form onSubmit={handleAddCompetitor} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                  Competitor Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corp"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-xl border border-glass-specular-border bg-surface-container-high px-3.5 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                  Website URL or Domain
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. competitor.com or https://competitor.com"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full rounded-xl border border-glass-specular-border bg-surface-container-high px-3.5 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="sandboxToggle"
                  checked={addSandbox}
                  onChange={(e) => setAddSandbox(e.target.checked)}
                  className="rounded border-glass-specular-border text-cyan-400 focus:ring-cyan-400"
                />
                <label htmlFor="sandboxToggle" className="text-xs text-on-surface-variant cursor-pointer">
                  Simulation / Sandbox probe (instant evaluation)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="px-4 py-2 rounded-xl bg-primary-container text-xs font-semibold text-on-primary-container shadow-md shadow-primary-container/20 hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isAdding ? "Capturing Baseline..." : "Add & Capture Baseline"}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  );
}

