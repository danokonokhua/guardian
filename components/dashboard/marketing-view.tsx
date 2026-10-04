"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";

interface ChannelPerformance {
  channel: string;
  campaignsCount: number;
  spendCents: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenueCents: number;
  costPerLeadCents: number;
  ctrPct: number;
  roas: number;
  spendSharePct: number;
  leadSharePct: number;
}

interface CampaignItem {
  id: string;
  name: string;
  channel: string;
  status: string;
  budgetDailyCents: number | null;
  flaggedReason?: string | null;
  latestSnapshot: {
    spendCents: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenueCents: number | null;
    ctrPct: number;
    costPerLeadCents: number;
    roas: number | null;
  } | null;
}

interface MarketingOverview {
  totalSpendCents: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalRevenueCents: number;
  blendedCtrPct: number;
  blendedCpcCents: number;
  blendedCostPerLeadCents: number;
  blendedRoas: number;
  activeCampaignsCount: number;
  flaggedCampaignsCount: number;
  channels: ChannelPerformance[];
  campaigns: CampaignItem[];
}

const channelLabels: Record<string, { label: string; icon: string; color: string }> = {
  GOOGLE_ADS: { label: "Google Ads", icon: "🔍", color: "text-blue-400" },
  META_ADS: { label: "Meta Ads", icon: "🌐", color: "text-indigo-400" },
  LINKEDIN_ADS: { label: "LinkedIn Ads", icon: "💼", color: "text-cyan-400" },
  EMAIL_MARKETING: { label: "Email / CRM", icon: "✉️", color: "text-emerald-400" },
  DIRECT_CRM: { label: "Direct CRM", icon: "📊", color: "text-purple-400" },
};

export function MarketingView({ organizationId }: { organizationId: string }) {
  const [overview, setOverview] = useState<MarketingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Add Campaign Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("GOOGLE_ADS");
  const [budgetDailyDollars, setBudgetDailyDollars] = useState("50");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/v1/organizations/${organizationId}/marketing`)
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error?.message || "Failed to load marketing intelligence.");
        }
        return r.json();
      })
      .then((body) => {
        if (!cancelled && body.data) {
          setOverview(body.data.overview);
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

  async function handleSeedDemoData() {
    setIsSeeding(true);
    try {
      const res = await fetch(`/api/v1/organizations/${organizationId}/marketing/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seedSandbox: true }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.message || "Failed to seed demo data.");
      setOverview(body.data.overview);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSeeding(false);
    }
  }

  async function handleAddCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setIsAdding(true);
    setAddError(null);

    const budgetCents = Math.round(Number.parseFloat(budgetDailyDollars || "0") * 100);

    try {
      const res = await fetch(`/api/v1/organizations/${organizationId}/marketing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          channel,
          budgetDailyCents: budgetCents > 0 ? budgetCents : undefined,
        }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.message || "Failed to create campaign.");

      setShowAddModal(false);
      setName("");
      setBudgetDailyDollars("50");
      setReloadTrigger((v) => v + 1);
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setIsAdding(false);
    }
  }

  async function handleToggleStatus(campaignId: string, currentStatus: string) {
    const newStatus = currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      const res = await fetch(
        `/api/v1/organizations/${organizationId}/marketing/campaigns/${campaignId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        },
      );
      if (!res.ok) throw new Error("Could not update campaign status.");
      setReloadTrigger((v) => v + 1);
    } catch (err: any) {
      alert(err.message);
    }
  }

  if (loading && !overview) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-on-surface-variant animate-pulse">
          <div className="h-4 w-4 rounded-full border-2 border-primary-container border-t-transparent animate-spin" />
          <span>Aggregating cross-channel marketing intelligence...</span>
        </div>
      </div>
    );
  }

  if (error && !overview) {
    return (
      <GlassCard className="p-8 text-center" glow="rose">
        <h3 className="text-lg font-semibold text-status-outage">Marketing Intelligence Error</h3>
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

  const campaigns = overview?.campaigns || [];
  const channels = overview?.channels || [];
  const totalSpendDollars = ((overview?.totalSpendCents ?? 0) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const totalRevenueDollars = ((overview?.totalRevenueCents ?? 0) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const blendedCplDollars = ((overview?.blendedCostPerLeadCents ?? 0) / 100).toFixed(2);

  return (
    <div className="space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-on-surface">
            Marketing Intelligence & Ad Spend Protection
          </h2>
          <p className="text-sm text-on-surface-variant">
            Track multi-channel ad spend, cost per lead, return on ad spend (ROAS), and prevent ad
            budget waste.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSeedDemoData}
            disabled={isSeeding}
            className="flex items-center gap-2 rounded-xl border border-glass-specular-border bg-surface-container-low/75 px-4 py-2.5 text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50"
          >
            {isSeeding ? (
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-container border-t-transparent" />
            ) : (
              <span>⚡</span>
            )}
            Simulate Channels (Demo)
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="rounded-xl bg-primary-container px-4 py-2.5 text-xs font-semibold text-on-primary-container shadow-md shadow-primary-container/20 hover:opacity-90 transition-opacity"
          >
            + Add Campaign
          </button>
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GlassCard className="p-5" glow="cyan">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>Total Ad Spend</span>
            <span className="font-mono text-cyan-400">7-DAY</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-on-surface">
              ${totalSpendDollars}
            </span>
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">
            {overview?.totalClicks.toLocaleString() ?? 0} clicks across{" "}
            {overview?.totalImpressions.toLocaleString() ?? 0} impressions
          </p>
        </GlassCard>

        <GlassCard className="p-5" glow="violet">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>Leads & Conversions</span>
            <span className="font-mono text-purple-400">ACQUISITION</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-on-surface">
              {overview?.totalConversions ?? 0}
            </span>
            <span className="text-xs text-on-surface-variant">leads</span>
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">
            Generated ${totalRevenueDollars} in pipeline revenue
          </p>
        </GlassCard>

        <GlassCard className="p-5" glow="emerald">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>Blended Cost Per Lead</span>
            <span className="font-mono text-emerald-400">UNIT ECONOMICS</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-on-surface">
              ${blendedCplDollars}
            </span>
            <span className="text-xs text-on-surface-variant">/lead</span>
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">
            {Number.parseFloat(blendedCplDollars) < 80 ? (
              <span className="text-emerald-400">Healthy acquisition economics</span>
            ) : (
              <span className="text-amber-400">CPL above optimal target threshold</span>
            )}
          </p>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>Blended ROAS</span>
            <span className="font-mono text-blue-400">RETURN</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-on-surface">
              {overview?.blendedRoas ?? 0}x
            </span>
            <span className="text-xs text-emerald-400">Target: ≥ 3.0x</span>
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">
            Blended CTR: {overview?.blendedCtrPct ?? 0}% (Avg CPC: $
            {((overview?.blendedCpcCents ?? 0) / 100).toFixed(2)})
          </p>
        </GlassCard>
      </div>

      {/* Cross-Channel Performance Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {channels.length === 0 ? (
          <GlassCard className="col-span-full p-8 text-center">
            <p className="text-sm text-on-surface-variant">
              No marketing channels connected yet. Click{" "}
              <strong className="text-on-surface">"Simulate Channels"</strong> to evaluate with demo
              data.
            </p>
          </GlassCard>
        ) : (
          channels.map((ch) => {
            const meta = channelLabels[ch.channel] || {
              label: ch.channel,
              icon: "📊",
              color: "text-on-surface",
            };
            const spend = (ch.spendCents / 100).toFixed(2);
            const cpl = (ch.costPerLeadCents / 100).toFixed(2);

            return (
              <GlassCard key={ch.channel} className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{meta.icon}</span>
                    <strong className={`text-sm ${meta.color}`}>{meta.label}</strong>
                  </div>
                  <span className="text-[11px] font-mono text-on-surface-variant">
                    {ch.spendSharePct}% spend
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-on-surface-variant">Spend:</span>
                    <span className="font-medium text-on-surface">${spend}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-on-surface-variant">Conversions:</span>
                    <span className="font-medium text-on-surface">
                      {ch.conversions} leads ({ch.leadSharePct}%)
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-on-surface-variant">CPL:</span>
                    <span className="font-mono text-on-surface">${cpl}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-on-surface-variant">ROAS:</span>
                    <span className="font-mono text-emerald-400">{ch.roas}x</span>
                  </div>
                </div>

                {/* Spend Share Progress Bar */}
                <div className="h-1.5 w-full rounded-full bg-surface-container-high overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 rounded-full"
                    style={{ width: `${Math.min(100, ch.spendSharePct)}%` }}
                  />
                </div>
              </GlassCard>
            );
          })
        )}
      </div>

      {/* Campaign Health Table */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-on-surface">Campaign Health & Economics</h3>
            <p className="text-xs text-on-surface-variant">
              Unit economics and budget efficiency across all monitored marketing campaigns
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-surface-container-high border border-glass-specular-border text-on-surface-variant">
            {campaigns.length} Campaigns ({overview?.flaggedCampaignsCount ?? 0} Flagged)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-glass-specular-border text-on-surface-variant">
                <th className="pb-3 font-semibold uppercase tracking-wider">Campaign & Channel</th>
                <th className="pb-3 font-semibold uppercase tracking-wider">Status</th>
                <th className="pb-3 font-semibold uppercase tracking-wider">Daily Budget</th>
                <th className="pb-3 font-semibold uppercase tracking-wider">7-Day Spend</th>
                <th className="pb-3 font-semibold uppercase tracking-wider">Leads</th>
                <th className="pb-3 font-semibold uppercase tracking-wider">CPL</th>
                <th className="pb-3 font-semibold uppercase tracking-wider">CTR</th>
                <th className="pb-3 font-semibold uppercase tracking-wider">ROAS</th>
                <th className="pb-3 font-semibold uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-specular-border">
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-on-surface-variant">
                    <p className="text-sm">No campaigns recorded yet.</p>
                    <p className="text-xs mt-1">
                      Click <strong className="text-on-surface">"Simulate Channels (Demo)"</strong>{" "}
                      to view simulated performance.
                    </p>
                  </td>
                </tr>
              ) : (
                campaigns.map((c) => {
                  const snap = c.latestSnapshot;
                  const channelInfo = channelLabels[c.channel] || {
                    label: c.channel,
                    icon: "📊",
                    color: "text-on-surface",
                  };
                  const spend = snap ? (snap.spendCents / 100).toFixed(2) : "0.00";
                  const cpl = snap ? (snap.costPerLeadCents / 100).toFixed(2) : "0.00";
                  const budget = c.budgetDailyCents
                    ? `$${(c.budgetDailyCents / 100).toFixed(0)}/day`
                    : "Uncapped";
                  const isFlagged = !!c.flaggedReason;

                  return (
                    <tr key={c.id} className="hover:bg-surface-container-high/40 transition-colors">
                      <td className="py-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <strong className="text-sm text-on-surface">{c.name}</strong>
                            {isFlagged && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/25">
                                ALERT
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-on-surface-variant font-mono">
                            <span>{channelInfo.icon}</span>
                            <span>{channelInfo.label}</span>
                          </div>
                          {c.flaggedReason && (
                            <p className="text-[11px] text-rose-400 font-medium pt-0.5">
                              ⚠️ {c.flaggedReason}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-4">
                        <button
                          onClick={() => handleToggleStatus(c.id, c.status)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase transition-colors ${
                            c.status === "ACTIVE"
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-surface-container-high text-on-surface-variant border border-glass-specular-border"
                          }`}
                        >
                          {c.status}
                        </button>
                      </td>
                      <td className="py-4 font-mono text-on-surface-variant">{budget}</td>
                      <td className="py-4 font-mono font-medium text-on-surface">${spend}</td>
                      <td className="py-4 font-mono font-semibold text-cyan-300">
                        {snap?.conversions ?? 0}
                      </td>
                      <td className="py-4">
                        <span
                          className={`font-mono px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                            Number.parseFloat(cpl) > 100
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          }`}
                        >
                          ${cpl}
                        </span>
                      </td>
                      <td className="py-4 font-mono text-on-surface">{snap?.ctrPct ?? 0}%</td>
                      <td className="py-4 font-mono text-emerald-400">{snap?.roas ?? 0}x</td>
                      <td className="py-4 text-right">
                        <button
                          onClick={() => handleToggleStatus(c.id, c.status)}
                          className="px-2.5 py-1 rounded-lg bg-surface-container-high border border-glass-specular-border text-[11px] font-medium text-on-surface hover:bg-surface-container-highest transition-colors"
                        >
                          {c.status === "ACTIVE" ? "Pause" : "Resume"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Ad Spend Protection & Waste Alerts Feed */}
      <GlassCard className="p-6">
        <h3 className="text-base font-semibold text-on-surface mb-1">
          Ad Spend Protection & Budget Health
        </h3>
        <p className="text-xs text-on-surface-variant mb-5">
          Autonomous anomaly detection safeguarding ad spend from zero-conversion drains and runaway
          acquisition costs
        </p>

        {campaigns.filter((c) => c.flaggedReason).length === 0 ? (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
            <span>🛡️</span>
            <span>
              All active marketing campaigns are operating within economic efficiency thresholds.
              Zero ad spend drain detected.
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns
              .filter((c) => c.flaggedReason)
              .map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/25"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm text-on-surface">{c.name}</strong>
                      <span className="text-xs text-rose-400 font-mono">({c.channel})</span>
                    </div>
                    <p className="text-xs text-rose-200">
                      <strong>Finding:</strong> {c.flaggedReason}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleStatus(c.id, c.status)}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 text-xs font-semibold text-white shadow-sm hover:bg-rose-500 transition-colors whitespace-nowrap self-start sm:self-center"
                  >
                    Pause Campaign
                  </button>
                </div>
              ))}
          </div>
        )}
      </GlassCard>

      {/* Add Campaign Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <GlassCard className="w-full max-w-md p-6" glow="cyan">
            <h3 className="text-lg font-bold text-on-surface">Add Marketing Campaign</h3>
            <p className="mt-1 text-xs text-on-surface-variant">
              Track multi-channel spend, pipeline leads, and economic return.
            </p>

            {addError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                {addError}
              </div>
            )}

            <form onSubmit={handleAddCampaign} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                  Campaign Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4 High-Intent Search"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-glass-specular-border bg-surface-container-high px-3.5 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                  Marketing Channel
                </label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full rounded-xl border border-glass-specular-border bg-surface-container-high px-3.5 py-2 text-sm text-on-surface focus:border-cyan-400 focus:outline-none"
                >
                  <option value="GOOGLE_ADS">Google Ads (Search / PMax)</option>
                  <option value="META_ADS">Meta Ads (Facebook / Instagram)</option>
                  <option value="LINKEDIN_ADS">LinkedIn Ads (B2B)</option>
                  <option value="EMAIL_MARKETING">Email Marketing / CRM</option>
                  <option value="DIRECT_CRM">Direct Sales / CRM</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                  Target Daily Budget ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={budgetDailyDollars}
                  onChange={(e) => setBudgetDailyDollars(e.target.value)}
                  className="w-full rounded-xl border border-glass-specular-border bg-surface-container-high px-3.5 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-cyan-400 focus:outline-none"
                />
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
                  {isAdding ? "Creating..." : "Create Campaign"}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
