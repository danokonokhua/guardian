"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";

interface ClientItem {
  id: string;
  clientName: string;
  clientDomain: string;
  contactEmail: string | null;
  contactName: string | null;
  status: string;
  monthlyRetainerCents: number;
  healthScore: number;
  riskLevel: "HEALTHY" | "DEGRADED" | "AT_RISK";
  lastScannedAt: string | null;
  notes: string | null;
}

interface BrandingItem {
  id: string;
  companyName: string;
  logoUrl: string | null;
  brandPrimaryColor: string | null;
  brandAccentColor: string | null;
  portalTitle: string | null;
  supportEmail: string | null;
  isWhiteLabelActive: boolean;
}

interface PortfolioOverview {
  totalClients: number;
  activeClients: number;
  totalMonthlyRetainerCents: number;
  averageHealthScore: number;
  healthyCount: number;
  degradedCount: number;
  atRiskCount: number;
  clients: ClientItem[];
  branding: BrandingItem | null;
}

export function AgencyView({ organizationId }: { organizationId: string }) {
  const [overview, setOverview] = useState<PortfolioOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Add Client Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientDomain, setClientDomain] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [retainerDollars, setRetainerDollars] = useState("500");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Branding Modal
  const [showBrandingModal, setShowBrandingModal] = useState(false);
  const [brandCompanyName, setBrandCompanyName] = useState("");
  const [brandLogoUrl, setBrandLogoUrl] = useState("");
  const [brandPrimaryColor, setBrandPrimaryColor] = useState("#06b6d4");
  const [brandAccentColor, setBrandAccentColor] = useState("#8b5cf6");
  const [brandPortalTitle, setBrandPortalTitle] = useState("");
  const [brandSupportEmail, setBrandSupportEmail] = useState("");
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [brandingError, setBrandingError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/v1/organizations/${organizationId}/agency`)
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error?.message || "Failed to load agency portfolio.");
        }
        return r.json();
      })
      .then((body) => {
        if (!cancelled && body.data) {
          const ov = body.data.overview;
          setOverview(ov);
          if (ov.branding) {
            setBrandCompanyName(ov.branding.companyName || "");
            setBrandLogoUrl(ov.branding.logoUrl || "");
            setBrandPrimaryColor(ov.branding.brandPrimaryColor || "#06b6d4");
            setBrandAccentColor(ov.branding.brandAccentColor || "#8b5cf6");
            setBrandPortalTitle(ov.branding.portalTitle || "");
            setBrandSupportEmail(ov.branding.supportEmail || "");
          }
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

  async function handleBulkScan() {
    setIsScanning(true);
    setScanMessage("Running portfolio-wide health scan across all client domains...");

    try {
      const res = await fetch(`/api/v1/organizations/${organizationId}/agency/bulk-scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.message || "Bulk scan failed.");

      setScanMessage(
        `Bulk scan complete! Scanned ${body.data.scannedCount} client domains in ${body.data.durationMs}ms.`,
      );
      setReloadTrigger((v) => v + 1);
      setTimeout(() => setScanMessage(null), 5000);
    } catch (err: any) {
      alert(err.message);
      setScanMessage(null);
    } finally {
      setIsScanning(false);
    }
  }

  async function handleAddClient(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim() || !clientDomain.trim()) return;

    setIsAdding(true);
    setAddError(null);

    const retainerCents = Math.round(Number.parseFloat(retainerDollars || "0") * 100);

    try {
      const res = await fetch(`/api/v1/organizations/${organizationId}/agency/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: clientName.trim(),
          clientDomain: clientDomain.trim(),
          contactEmail: contactEmail.trim() || null,
          contactName: contactName.trim() || null,
          monthlyRetainerCents: retainerCents,
        }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.message || "Failed to register client.");

      setShowAddModal(false);
      setClientName("");
      setClientDomain("");
      setContactEmail("");
      setContactName("");
      setRetainerDollars("500");
      setReloadTrigger((v) => v + 1);
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setIsAdding(false);
    }
  }

  async function handleSaveBranding(e: React.FormEvent) {
    e.preventDefault();
    if (!brandCompanyName.trim()) return;

    setIsSavingBranding(true);
    setBrandingError(null);

    try {
      const res = await fetch(`/api/v1/organizations/${organizationId}/agency/branding`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: brandCompanyName.trim(),
          logoUrl: brandLogoUrl.trim() || null,
          brandPrimaryColor: brandPrimaryColor.trim() || null,
          brandAccentColor: brandAccentColor.trim() || null,
          portalTitle: brandPortalTitle.trim() || null,
          supportEmail: brandSupportEmail.trim() || null,
          isWhiteLabelActive: true,
        }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.message || "Failed to save branding.");

      setShowBrandingModal(false);
      setReloadTrigger((v) => v + 1);
    } catch (err: any) {
      setBrandingError(err.message);
    } finally {
      setIsSavingBranding(false);
    }
  }

  async function handleDeleteClient(clientId: string, name: string) {
    if (!confirm(`Are you sure you want to remove client "${name}" from your portfolio?`)) return;

    try {
      const res = await fetch(
        `/api/v1/organizations/${organizationId}/agency/clients/${clientId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to delete client.");
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
          <span>Loading agency command center...</span>
        </div>
      </div>
    );
  }

  if (error && !overview) {
    return (
      <GlassCard className="p-8 text-center" glow="rose">
        <h3 className="text-lg font-semibold text-status-outage">Agency Platform Error</h3>
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

  const clients = overview?.clients || [];
  const retainerMRRDollars = ((overview?.totalMonthlyRetainerCents ?? 0) / 100).toLocaleString(
    undefined,
    { minimumFractionDigits: 0, maximumFractionDigits: 0 },
  );

  return (
    <div className="space-y-8">
      {/* Top Header Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-on-surface">
            Agency Command Center & Client Management
          </h2>
          <p className="text-sm text-on-surface-variant">
            Manage client websites, track managed retainer revenue, run bulk health scans, and customize white-label branding.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBrandingModal(true)}
            className="flex items-center gap-2 rounded-xl border border-glass-specular-border bg-surface-container-low/75 px-4 py-2.5 text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <span>🎨</span> White-Label Branding
          </button>
          <button
            onClick={handleBulkScan}
            disabled={isScanning || clients.length === 0}
            className="flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
          >
            {isScanning ? (
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            ) : (
              <span>⚡</span>
            )}
            Run Portfolio Scan
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="rounded-xl bg-primary-container px-4 py-2.5 text-xs font-semibold text-on-primary-container shadow-md shadow-primary-container/20 hover:opacity-90 transition-opacity"
          >
            + Add Client
          </button>
        </div>
      </div>

      {scanMessage && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-xs text-cyan-200">
          <span>✨</span>
          <span>{scanMessage}</span>
        </div>
      )}

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GlassCard className="p-5" glow="cyan">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>Managed Clients</span>
            <span className="font-mono text-cyan-400">PORTFOLIO</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-on-surface">
              {overview?.activeClients ?? 0}
            </span>
            <span className="text-xs text-on-surface-variant">
              / {overview?.totalClients ?? 0} total
            </span>
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">
            Client domains monitored with continuous health surveillance
          </p>
        </GlassCard>

        <GlassCard className="p-5" glow="violet">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>Managed Retainer MRR</span>
            <span className="font-mono text-purple-400">REVENUE</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-on-surface">
              ${retainerMRRDollars}
            </span>
            <span className="text-xs text-on-surface-variant">/month</span>
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">
            Monthly agency maintenance contracts under management
          </p>
        </GlassCard>

        <GlassCard className="p-5" glow="emerald">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>Portfolio Health Average</span>
            <span className="font-mono text-emerald-400">SCORE</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-on-surface">
              {overview?.averageHealthScore ?? 100}
            </span>
            <span className="text-xs text-on-surface-variant">/ 100</span>
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">
            {overview?.healthyCount ?? 0} Healthy · {overview?.degradedCount ?? 0} Degraded ·{" "}
            {overview?.atRiskCount ?? 0} At Risk
          </p>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>White-Label Status</span>
            <span className="font-mono text-blue-400">BRANDING</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-on-surface">
              {overview?.branding?.isWhiteLabelActive ? "Active" : "Standard"}
            </span>
            {overview?.branding?.isWhiteLabelActive && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                PRO-BRANDED
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">
            {overview?.branding?.companyName
              ? `Branded as "${overview.branding.companyName}"`
              : "Default Guardian Portal"}
          </p>
        </GlassCard>
      </div>

      {/* Client Health Matrix Table */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-on-surface">Client Health Matrix</h3>
            <p className="text-xs text-on-surface-variant">
              Centralized status, digital health scores, and retainers across all agency client accounts
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-surface-container-high border border-glass-specular-border text-on-surface-variant">
            {clients.length} Accounts
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-glass-specular-border text-on-surface-variant">
                <th className="pb-3 font-semibold uppercase tracking-wider">Client & Domain</th>
                <th className="pb-3 font-semibold uppercase tracking-wider">Status</th>
                <th className="pb-3 font-semibold uppercase tracking-wider">Health Score</th>
                <th className="pb-3 font-semibold uppercase tracking-wider">Risk Level</th>
                <th className="pb-3 font-semibold uppercase tracking-wider">Monthly Retainer</th>
                <th className="pb-3 font-semibold uppercase tracking-wider">Primary Contact</th>
                <th className="pb-3 font-semibold uppercase tracking-wider">Last Audit</th>
                <th className="pb-3 font-semibold uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-specular-border">
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-on-surface-variant">
                    <p className="text-sm">No clients registered in your agency roster yet.</p>
                    <p className="text-xs mt-1">
                      Click <strong className="text-on-surface">"+ Add Client"</strong> to register your first client domain.
                    </p>
                  </td>
                </tr>
              ) : (
                clients.map((c) => {
                  const retainer = (c.monthlyRetainerCents / 100).toFixed(0);
                  const lastScan = c.lastScannedAt
                    ? new Date(c.lastScannedAt).toLocaleDateString()
                    : "Not yet scanned";

                  return (
                    <tr key={c.id} className="hover:bg-surface-container-high/40 transition-colors">
                      <td className="py-4">
                        <div className="space-y-0.5">
                          <strong className="text-sm text-on-surface">{c.clientName}</strong>
                          <div className="text-[11px] font-mono text-cyan-400">
                            {c.clientDomain}
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            c.status === "ACTIVE"
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-surface-container-high text-on-surface-variant border border-glass-specular-border"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-4">
                        <span
                          className={`font-mono px-2 py-0.5 rounded text-xs font-bold ${
                            c.healthScore >= 85
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                              : c.healthScore >= 65
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/25"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/25"
                          }`}
                        >
                          {c.healthScore} / 100
                        </span>
                      </td>
                      <td className="py-4">
                        <span
                          className={`text-[11px] font-semibold ${
                            c.riskLevel === "HEALTHY"
                              ? "text-emerald-400"
                              : c.riskLevel === "DEGRADED"
                              ? "text-amber-400"
                              : "text-rose-400"
                          }`}
                        >
                          {c.riskLevel === "HEALTHY"
                            ? "✓ Low Risk"
                            : c.riskLevel === "DEGRADED"
                            ? "⚠️ Degraded"
                            : "🚨 Critical Risk"}
                        </span>
                      </td>
                      <td className="py-4 font-mono font-medium text-on-surface">
                        ${retainer}/mo
                      </td>
                      <td className="py-4">
                        <div className="text-xs text-on-surface">
                          {c.contactName || "—"}
                        </div>
                        {c.contactEmail && (
                          <div className="text-[11px] text-on-surface-variant">
                            {c.contactEmail}
                          </div>
                        )}
                      </td>
                      <td className="py-4 font-mono text-[11px] text-on-surface-variant">
                        {lastScan}
                      </td>
                      <td className="py-4 text-right">
                        <button
                          onClick={() => handleDeleteClient(c.id, c.clientName)}
                          className="px-2.5 py-1 rounded-lg bg-surface-container-high border border-glass-specular-border text-[11px] font-medium text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 transition-colors"
                        >
                          Delete
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

      {/* Add Client Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <GlassCard className="w-full max-w-md p-6" glow="cyan">
            <h3 className="text-lg font-bold text-on-surface">Add Client to Portfolio</h3>
            <p className="mt-1 text-xs text-on-surface-variant">
              Register a client domain for multi-tenant health monitoring and retainer tracking.
            </p>

            {addError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                {addError}
              </div>
            )}

            <form onSubmit={handleAddClient} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                  Client / Business Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Legal Group"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full rounded-xl border border-glass-specular-border bg-surface-container-high px-3.5 py-2 text-sm text-on-surface focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                  Client Domain
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. apexlegal.com"
                  value={clientDomain}
                  onChange={(e) => setClientDomain(e.target.value)}
                  className="w-full rounded-xl border border-glass-specular-border bg-surface-container-high px-3.5 py-2 text-sm text-on-surface focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sarah Connor"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full rounded-xl border border-glass-specular-border bg-surface-container-high px-3.5 py-2 text-sm text-on-surface focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    placeholder="sarah@apex.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full rounded-xl border border-glass-specular-border bg-surface-container-high px-3.5 py-2 text-sm text-on-surface focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                  Monthly Retainer ($ / month)
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={retainerDollars}
                  onChange={(e) => setRetainerDollars(e.target.value)}
                  className="w-full rounded-xl border border-glass-specular-border bg-surface-container-high px-3.5 py-2 text-sm text-on-surface focus:border-cyan-400 focus:outline-none"
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
                  {isAdding ? "Registering..." : "Add Client"}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* White-Label Branding Modal */}
      {showBrandingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <GlassCard className="w-full max-w-lg p-6" glow="violet">
            <h3 className="text-lg font-bold text-on-surface">White-Label Branding Settings</h3>
            <p className="mt-1 text-xs text-on-surface-variant">
              Rebrand Guardian with your agency name, logo, custom color palette, and client portal title.
            </p>

            {brandingError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                {brandingError}
              </div>
            )}

            <form onSubmit={handleSaveBranding} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                  Agency / Brand Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Digital Studios"
                  value={brandCompanyName}
                  onChange={(e) => setBrandCompanyName(e.target.value)}
                  className="w-full rounded-xl border border-glass-specular-border bg-surface-container-high px-3.5 py-2 text-sm text-on-surface focus:border-violet-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                  Custom Logo URL (SVG / PNG)
                </label>
                <input
                  type="url"
                  placeholder="https://youragency.com/logo.svg"
                  value={brandLogoUrl}
                  onChange={(e) => setBrandLogoUrl(e.target.value)}
                  className="w-full rounded-xl border border-glass-specular-border bg-surface-container-high px-3.5 py-2 text-sm text-on-surface focus:border-violet-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                    Primary Brand Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brandPrimaryColor}
                      onChange={(e) => setBrandPrimaryColor(e.target.value)}
                      className="h-8 w-10 cursor-pointer rounded border border-glass-specular-border bg-transparent"
                    />
                    <input
                      type="text"
                      value={brandPrimaryColor}
                      onChange={(e) => setBrandPrimaryColor(e.target.value)}
                      className="w-full rounded-xl border border-glass-specular-border bg-surface-container-high px-3 py-1.5 text-xs text-on-surface font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                    Accent Brand Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brandAccentColor}
                      onChange={(e) => setBrandAccentColor(e.target.value)}
                      className="h-8 w-10 cursor-pointer rounded border border-glass-specular-border bg-transparent"
                    />
                    <input
                      type="text"
                      value={brandAccentColor}
                      onChange={(e) => setBrandAccentColor(e.target.value)}
                      className="w-full rounded-xl border border-glass-specular-border bg-surface-container-high px-3 py-1.5 text-xs text-on-surface font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                  Custom Portal Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Apex Client Security & Performance Hub"
                  value={brandPortalTitle}
                  onChange={(e) => setBrandPortalTitle(e.target.value)}
                  className="w-full rounded-xl border border-glass-specular-border bg-surface-container-high px-3.5 py-2 text-sm text-on-surface focus:border-violet-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                  Agency Support Email
                </label>
                <input
                  type="email"
                  placeholder="support@youragency.com"
                  value={brandSupportEmail}
                  onChange={(e) => setBrandSupportEmail(e.target.value)}
                  className="w-full rounded-xl border border-glass-specular-border bg-surface-container-high px-3.5 py-2 text-sm text-on-surface focus:border-violet-400 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowBrandingModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingBranding}
                  className="px-4 py-2 rounded-xl bg-primary-container text-xs font-semibold text-on-primary-container shadow-md shadow-primary-container/20 hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isSavingBranding ? "Saving..." : "Save Branding"}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  );
}

