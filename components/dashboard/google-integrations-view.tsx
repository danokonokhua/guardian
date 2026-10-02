"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";

interface IntegrationItem {
  id: string;
  provider: "GA4" | "SEARCH_CONSOLE" | "BUSINESS_PROFILE";
  status: "CONNECTED" | "NEEDS_REAUTH" | "DISCONNECTED" | "ERROR";
  propertyName?: string;
  accountEmail?: string;
  lastSyncAt?: string;
  lastError?: string;
  syncSummary?: any;
}

export function GoogleIntegrationsView({ organizationId }: { organizationId: string }) {
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [plan, setPlan] = useState<string>("PRO");
  const [loading, setLoading] = useState(true);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/organizations/${organizationId}/integrations/google`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load integrations.");
        return r.json();
      })
      .then((body) => {
        if (!cancelled && body.data) {
          setIntegrations(body.data.integrations || []);
          setPlan(body.data.plan || "PRO");
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
  }, [organizationId, reload]);

  async function handleConnect(provider: "GA4" | "SEARCH_CONSOLE" | "BUSINESS_PROFILE") {
    setBusyProvider(provider);
    setError(null);
    try {
      const res = await fetch(`/api/v1/organizations/${organizationId}/integrations/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          propertyName:
            provider === "GA4"
              ? "Google Analytics 4 Property"
              : provider === "SEARCH_CONSOLE"
                ? "Search Console Property"
                : "Google Business Profile Location",
          mode: "sandbox",
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error?.message || "Failed to connect service.");
      }
      setReload((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setBusyProvider(null);
    }
  }

  async function handleSync(integrationId: string) {
    setBusyProvider(integrationId);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/organizations/${organizationId}/integrations/google/${integrationId}`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error("Sync failed.");
      setReload((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusyProvider(null);
    }
  }

  async function handleDisconnect(integrationId: string) {
    if (!confirm("Are you sure you want to disconnect this Google service?")) return;
    setBusyProvider(integrationId);
    try {
      const res = await fetch(
        `/api/v1/organizations/${organizationId}/integrations/google/${integrationId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Disconnection failed.");
      setReload((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnection failed");
    } finally {
      setBusyProvider(null);
    }
  }

  const ga4 = integrations.find((i) => i.provider === "GA4");
  const gsc = integrations.find((i) => i.provider === "SEARCH_CONSOLE");
  const gbp = integrations.find((i) => i.provider === "BUSINESS_PROFILE");

  const isEligible = ["PRO", "AGENCY", "WHITE_LABEL", "ENTERPRISE"].includes(plan);

  return (
    <div className="space-y-8 mt-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-[#00F0FF] font-bold">
            PHASE 15 · DIGITAL BUSINESS INTELLIGENCE
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">
            Google Intelligence & Analytics Hub
          </h2>
          <p className="text-sm text-neutral-300 mt-1 max-w-2xl">
            Correlate website health with real visitor traffic, search impression drops, and customer
            reputation to stop silent revenue leaks.
          </p>
        </div>
        <button
          onClick={() => setReload((n) => n + 1)}
          disabled={loading}
          className="self-start sm:self-auto px-4 py-2 rounded-xl text-xs font-mono uppercase tracking-wider bg-white/5 hover:bg-white/10 text-neutral-200 border border-white/10 transition-colors"
        >
          {loading ? "Refreshing…" : "↻ Refresh"}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {!isEligible && (
        <GlassCard variant="elevated" glow="violet" className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-[#00F0FF] font-bold">
                PRO PLAN CAPABILITY
              </span>
              <h3 className="text-xl font-bold text-white mt-1">
                Unlock Google Analytics, Search Console & Reputation Tracking
              </h3>
              <p className="text-sm text-neutral-300 mt-2 max-w-xl leading-relaxed">
                Connect your Google accounts to detect traffic crashes week-over-week, catch de-indexed
                pages immediately, and monitor Google Business reviews in one place.
              </p>
            </div>
            <Link
              href="/billing"
              className="px-6 py-3 rounded-full text-xs font-bold uppercase tracking-wider bg-[#00F0FF] text-[#0A0D14] shadow-[0_0_20px_rgba(0,240,255,0.4)] hover:bg-[#38F4FF] transition-all text-center whitespace-nowrap"
            >
              Upgrade to Pro ↗
            </Link>
          </div>
        </GlassCard>
      )}

      {/* Grid of 3 Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GA4 Card */}
        <GlassCard variant="elevated" glow="none" className="p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-[#00F0FF] font-bold tracking-wider">
                01 / ANALYTICS
              </span>
              {ga4 ? (
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  ● ACTIVE
                </span>
              ) : (
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-neutral-800 border border-white/10 text-neutral-400">
                  DISCONNECTED
                </span>
              )}
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Google Analytics 4 (GA4)</h3>
              <p className="text-xs text-neutral-400 mt-1">
                Monitors session momentum and triggers alerts on &gt;30% week-over-week traffic drops.
              </p>
            </div>

            {ga4?.syncSummary ? (
              <div className="space-y-3 pt-3 border-t border-white/10">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-2xl font-bold text-white">
                      {ga4.syncSummary.currentSessions?.toLocaleString() ?? "—"}
                    </div>
                    <div className="text-[10px] font-mono text-neutral-400 mt-0.5">7-DAY SESSIONS</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div
                      className={`text-2xl font-bold ${
                        (ga4.syncSummary.sessionChangePct ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {(ga4.syncSummary.sessionChangePct ?? 0) > 0 ? "+" : ""}
                      {ga4.syncSummary.sessionChangePct ?? 0}%
                    </div>
                    <div className="text-[10px] font-mono text-neutral-400 mt-0.5">VS PRIOR WEEK</div>
                  </div>
                </div>

                <div className="text-xs text-neutral-300 space-y-1 pt-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Active Users:</span>
                    <span>{ga4.syncSummary.activeUsers?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Key Goal Conversions:</span>
                    <span className="text-[#00F0FF]">{ga4.syncSummary.keyConversions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Bounce Rate:</span>
                    <span>{ga4.syncSummary.bounceRatePct}%</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-xs text-neutral-400 text-center">
                Connect your GA4 stream to receive automated traffic crash detection and conversion tracking.
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-white/10">
            {ga4 ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSync(ga4.id)}
                  disabled={busyProvider === ga4.id}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-colors"
                >
                  {busyProvider === ga4.id ? "Syncing…" : "Sync Now"}
                </button>
                <button
                  onClick={() => handleDisconnect(ga4.id)}
                  disabled={busyProvider === ga4.id}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleConnect("GA4")}
                disabled={busyProvider === "GA4" || !isEligible}
                className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#00F0FF] text-[#0A0D14] shadow-[0_0_15px_rgba(0,240,255,0.3)] hover:bg-[#38F4FF] transition-all disabled:opacity-40"
              >
                {busyProvider === "GA4" ? "Connecting…" : "Connect GA4"}
              </button>
            )}
          </div>
        </GlassCard>

        {/* Search Console Card */}
        <GlassCard variant="elevated" glow="none" className="p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-[#00F0FF] font-bold tracking-wider">
                02 / SEARCH CONSOLE
              </span>
              {gsc ? (
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  ● ACTIVE
                </span>
              ) : (
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-neutral-800 border border-white/10 text-neutral-400">
                  DISCONNECTED
                </span>
              )}
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Google Search Console</h3>
              <p className="text-xs text-neutral-400 mt-1">
                Detects organic ranking crashes, visibility drops, and critical Google indexing errors.
              </p>
            </div>

            {gsc?.syncSummary ? (
              <div className="space-y-3 pt-3 border-t border-white/10">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-2xl font-bold text-white">
                      {gsc.syncSummary.currentClicks?.toLocaleString() ?? "—"}
                    </div>
                    <div className="text-[10px] font-mono text-neutral-400 mt-0.5">28-DAY CLICKS</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-2xl font-bold text-white">
                      {gsc.syncSummary.impressions?.toLocaleString() ?? "—"}
                    </div>
                    <div className="text-[10px] font-mono text-neutral-400 mt-0.5">IMPRESSIONS</div>
                  </div>
                </div>

                <div className="text-xs text-neutral-300 space-y-1 pt-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Average CTR:</span>
                    <span>{gsc.syncSummary.averageCtrPct}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Average Position:</span>
                    <span className="text-emerald-400">#{gsc.syncSummary.averagePosition}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-xs text-neutral-400 text-center">
                Connect Google Search Console to monitor organic keywords, clicks, and page indexing.
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-white/10">
            {gsc ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSync(gsc.id)}
                  disabled={busyProvider === gsc.id}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-colors"
                >
                  {busyProvider === gsc.id ? "Syncing…" : "Sync Now"}
                </button>
                <button
                  onClick={() => handleDisconnect(gsc.id)}
                  disabled={busyProvider === gsc.id}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleConnect("SEARCH_CONSOLE")}
                disabled={busyProvider === "SEARCH_CONSOLE" || !isEligible}
                className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#00F0FF] text-[#0A0D14] shadow-[0_0_15px_rgba(0,240,255,0.3)] hover:bg-[#38F4FF] transition-all disabled:opacity-40"
              >
                {busyProvider === "SEARCH_CONSOLE" ? "Connecting…" : "Connect Search Console"}
              </button>
            )}
          </div>
        </GlassCard>

        {/* Business Profile Card */}
        <GlassCard variant="elevated" glow="none" className="p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-[#00F0FF] font-bold tracking-wider">
                03 / REPUTATION
              </span>
              {gbp ? (
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  ● ACTIVE
                </span>
              ) : (
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-neutral-800 border border-white/10 text-neutral-400">
                  DISCONNECTED
                </span>
              )}
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Google Business Profile</h3>
              <p className="text-xs text-neutral-400 mt-1">
                Monitors local star ratings, customer review velocity, and alerts on unanswered feedback.
              </p>
            </div>

            {gbp?.syncSummary ? (
              <div className="space-y-3 pt-3 border-t border-white/10">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-2xl font-bold text-amber-400">
                      ★ {gbp.syncSummary.averageRating}
                    </div>
                    <div className="text-[10px] font-mono text-neutral-400 mt-0.5">AVERAGE RATING</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-2xl font-bold text-white">
                      {gbp.syncSummary.totalReviewCount}
                    </div>
                    <div className="text-[10px] font-mono text-neutral-400 mt-0.5">TOTAL REVIEWS</div>
                  </div>
                </div>

                <div className="text-xs text-neutral-300 space-y-1 pt-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Rating Health:</span>
                    <span
                      className={
                        gbp.syncSummary.ratingHealth === "HEALTHY" ? "text-emerald-400" : "text-amber-400"
                      }
                    >
                      {gbp.syncSummary.ratingHealth}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Awaiting Reply:</span>
                    <span className={gbp.syncSummary.unansweredReviewsCount > 0 ? "text-rose-400 font-bold" : ""}>
                      {gbp.syncSummary.unansweredReviewsCount} reviews
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-xs text-neutral-400 text-center">
                Connect Google Business Profile to track reviews, ratings, and local map discovery signals.
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-white/10">
            {gbp ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSync(gbp.id)}
                  disabled={busyProvider === gbp.id}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-colors"
                >
                  {busyProvider === gbp.id ? "Syncing…" : "Sync Now"}
                </button>
                <button
                  onClick={() => handleDisconnect(gbp.id)}
                  disabled={busyProvider === gbp.id}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleConnect("BUSINESS_PROFILE")}
                disabled={busyProvider === "BUSINESS_PROFILE" || !isEligible}
                className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#00F0FF] text-[#0A0D14] shadow-[0_0_15px_rgba(0,240,255,0.3)] hover:bg-[#38F4FF] transition-all disabled:opacity-40"
              >
                {busyProvider === "BUSINESS_PROFILE" ? "Connecting…" : "Connect Business Profile"}
              </button>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

