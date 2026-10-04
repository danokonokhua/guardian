"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";

interface PluginField {
  name: string;
  label: string;
  type: string;
  placeholder?: string;
  required: boolean;
  isSecret?: boolean;
  options?: { label: string; value: string }[];
  defaultValue?: string | number;
  description?: string;
}

interface MarketplacePlugin {
  id: string;
  name: string;
  description: string;
  category: "alerting" | "telemetry" | "remediation" | "analytics" | "developer";
  author: string;
  version: string;
  icon: string;
  badge?: string;
  requiredPlan?: string;
  fields: PluginField[];
}

interface InstalledPluginSummary {
  plugin: MarketplacePlugin;
  install: {
    id: string;
    pluginId: string;
    status: string;
    config: Record<string, unknown>;
    lastSyncAt: string | null;
    lastError: string | null;
  } | null;
  isInstalled: boolean;
  status: string;
}

interface MarketplaceOverview {
  catalogCount: number;
  installedCount: number;
  activeCount: number;
  plugins: InstalledPluginSummary[];
}

export function MarketplaceView({ organizationId }: { organizationId: string }) {
  const [overview, setOverview] = useState<MarketplaceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter category tab
  const [activeTab, setActiveTab] = useState<string>("all");

  // Modal configure / install state
  const [activeModalPlugin, setActiveModalPlugin] = useState<MarketplacePlugin | null>(null);
  const [formConfig, setFormConfig] = useState<Record<string, any>>({});
  const [formCredentials, setFormCredentials] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Test action feedback
  const [testingPluginId, setTestingPluginId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  const fetchCatalog = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/v1/organizations/${organizationId}/marketplace`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || "Failed to load marketplace catalog");
      }
      const data = await res.json();
      setOverview(data.data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch marketplace overview");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, [organizationId]);

  const openInstallModal = (item: InstalledPluginSummary) => {
    setActiveModalPlugin(item.plugin);
    setFormError(null);
    const initialConfig: Record<string, any> = {};
    const initialCreds: Record<string, any> = {};

    item.plugin.fields.forEach((f) => {
      const existingVal = (item.install?.config as any)?.[f.name];
      if (existingVal !== undefined) {
        initialConfig[f.name] = existingVal;
      } else if (f.defaultValue !== undefined) {
        initialConfig[f.name] = f.defaultValue;
      } else {
        initialConfig[f.name] = "";
      }
    });

    setFormConfig(initialConfig);
    setFormCredentials(initialCreds);
  };

  const handleInstallSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalPlugin) return;

    try {
      setSubmitting(true);
      setFormError(null);

      const res = await fetch(`/api/v1/organizations/${organizationId}/marketplace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pluginId: activeModalPlugin.id,
          config: formConfig,
          credentials: formCredentials,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || "Failed to install plugin");
      }

      setActiveModalPlugin(null);
      await fetchCatalog();
    } catch (err: any) {
      setFormError(err.message || "Failed to save integration configuration");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (pluginId: string, currentStatus: string) => {
    try {
      const nextStatus = currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE";
      const res = await fetch(`/api/v1/organizations/${organizationId}/marketplace/${pluginId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error("Failed to toggle status");
      await fetchCatalog();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUninstall = async (pluginId: string) => {
    if (!confirm("Are you sure you want to disconnect this plugin? Stored configuration will be purged.")) return;
    try {
      const res = await fetch(`/api/v1/organizations/${organizationId}/marketplace/${pluginId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to uninstall plugin");
      await fetchCatalog();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTestPlugin = async (pluginId: string) => {
    try {
      setTestingPluginId(pluginId);
      setTestResult(null);
      const res = await fetch(`/api/v1/organizations/${organizationId}/marketplace/${pluginId}/test`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Test signal failed");
      }
      setTestResult({ id: pluginId, success: true, message: data.data.message });
      await fetchCatalog();
    } catch (err: any) {
      setTestResult({ id: pluginId, success: false, message: err.message });
    } finally {
      setTestingPluginId(null);
    }
  };

  const filteredPlugins = (overview?.plugins || []).filter((item) => {
    if (activeTab === "all") return true;
    if (activeTab === "installed") return item.isInstalled;
    return item.plugin.category === activeTab;
  });

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-glass-subtle-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🔌</span>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-on-surface">
              Marketplace & Integration Hub
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              PRD Phase 25
            </span>
          </div>
          <p className="text-sm md:text-base text-on-surface-variant max-w-2xl">
            Extend Guardian with turnkey alerting webhooks, telemetry exporters, AutoFix connectors, and developer bridges.
          </p>
        </div>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-5 border-l-4 border-l-cyan-500 bg-surface-container/60">
          <div className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">Available Plugins</div>
          <div className="text-3xl font-black text-on-surface mt-2">{overview?.catalogCount ?? 8}</div>
          <div className="text-xs text-on-surface-variant mt-1">Official & partner integrations</div>
        </GlassCard>

        <GlassCard className="p-5 border-l-4 border-l-emerald-500 bg-surface-container/60">
          <div className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">Active Integrations</div>
          <div className="text-3xl font-black text-emerald-400 mt-2">{overview?.activeCount ?? 0}</div>
          <div className="text-xs text-on-surface-variant mt-1">Currently synchronizing & routing</div>
        </GlassCard>

        <GlassCard className="p-5 border-l-4 border-l-purple-500 bg-surface-container/60">
          <div className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">Installed Extensions</div>
          <div className="text-3xl font-black text-purple-400 mt-2">{overview?.installedCount ?? 0}</div>
          <div className="text-xs text-on-surface-variant mt-1">Configured for your organization</div>
        </GlassCard>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-glass-subtle-border pb-3">
        {[
          { id: "all", label: "All Integrations" },
          { id: "installed", label: `Installed (${overview?.installedCount ?? 0})` },
          { id: "alerting", label: "Alerting & Ops" },
          { id: "telemetry", label: "Telemetry & APM" },
          { id: "remediation", label: "Remediation" },
          { id: "developer", label: "Developer & Sync" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.id
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
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

      {/* Test feedback */}
      {testResult && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center justify-between border ${
            testResult.success
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{testResult.success ? "✅" : "❌"}</span>
            <span>{testResult.message}</span>
          </div>
          <button
            onClick={() => setTestResult(null)}
            className="text-xs opacity-70 hover:opacity-100 underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Plugin Cards Grid */}
      {loading ? (
        <div className="py-16 text-center text-on-surface-variant animate-pulse">
          Loading Marketplace catalog...
        </div>
      ) : filteredPlugins.length === 0 ? (
        <div className="py-16 text-center text-on-surface-variant border border-dashed border-glass-subtle-border rounded-2xl">
          <p className="text-base font-semibold">No plugins found in this category.</p>
          <p className="text-xs text-on-surface-variant mt-1">Try selecting another filter above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlugins.map((item) => {
            const { plugin, install, isInstalled, status } = item;
            const isPaused = status === "PAUSED";
            const isTesting = testingPluginId === plugin.id;

            return (
              <GlassCard
                key={plugin.id}
                className="flex flex-col justify-between p-6 rounded-2xl border border-glass-subtle-border bg-surface-container/40 hover:border-cyan-500/30 transition-all shadow-lg"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center text-xl shadow-inner">
                        {plugin.category === "alerting" && "🔔"}
                        {plugin.category === "telemetry" && "📈"}
                        {plugin.category === "remediation" && "⚡"}
                        {plugin.category === "developer" && "💻"}
                        {plugin.category === "analytics" && "📊"}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-on-surface tracking-tight leading-tight">
                          {plugin.name}
                        </h3>
                        <p className="text-xs text-on-surface-variant">by {plugin.author}</p>
                      </div>
                    </div>

                    {plugin.badge && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-neutral-800 text-neutral-300 border border-neutral-700">
                        {plugin.badge}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-on-surface-variant line-clamp-3 mb-4 leading-relaxed">
                    {plugin.description}
                  </p>

                  {/* Requirements / Status pill */}
                  <div className="flex items-center gap-2 mb-4">
                    {plugin.requiredPlan && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        {plugin.requiredPlan}+ Plan
                      </span>
                    )}
                    <span className="text-[10px] text-neutral-400">v{plugin.version}</span>
                    {isInstalled && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ml-auto ${
                          status === "ACTIVE"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                            : "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                        }`}
                      >
                        {status}
                      </span>
                    )}
                  </div>

                  {isInstalled && install?.lastSyncAt && (
                    <div className="text-[11px] text-neutral-400 mb-4 bg-neutral-900/60 p-2 rounded-lg border border-neutral-800">
                      <span>Last verified: {new Date(install.lastSyncAt).toLocaleTimeString()}</span>
                    </div>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="border-t border-glass-subtle-border pt-4 mt-2">
                  {isInstalled ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTestPlugin(plugin.id)}
                          disabled={isTesting}
                          className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 transition-all flex items-center justify-center gap-1.5"
                        >
                          {isTesting ? "Testing..." : "⚡ Send Test"}
                        </button>
                        <button
                          onClick={() => openInstallModal(item)}
                          className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-all"
                        >
                          Configure
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <button
                          onClick={() => handleToggleStatus(plugin.id, status)}
                          className="text-neutral-400 hover:text-neutral-200 transition-colors underline"
                        >
                          {isPaused ? "Resume sync" : "Pause sync"}
                        </button>
                        <button
                          onClick={() => handleUninstall(plugin.id)}
                          className="text-rose-400 hover:text-rose-300 transition-colors"
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => openInstallModal(item)}
                      className="w-full py-2 px-4 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md hover:shadow-cyan-500/25 transition-all flex items-center justify-center gap-2"
                    >
                      <span>Connect Integration</span>
                      <span>→</span>
                    </button>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Configuration / Installation Modal */}
      {activeModalPlugin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-700 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚙️</span>
                <h3 className="text-lg font-bold text-white">
                  Configure {activeModalPlugin.name}
                </h3>
              </div>
              <button
                onClick={() => setActiveModalPlugin(null)}
                className="text-neutral-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              {activeModalPlugin.description}
            </p>

            {formError && (
              <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleInstallSubmit} className="space-y-4">
              {activeModalPlugin.fields.map((field) => (
                <div key={field.name} className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-200 flex items-center justify-between">
                    <span>{field.label} {field.required && <span className="text-rose-400">*</span>}</span>
                    {field.isSecret && (
                      <span className="text-[10px] text-cyan-400">🔒 AES-256 Encrypted</span>
                    )}
                  </label>

                  {field.type === "select" ? (
                    <select
                      value={formConfig[field.name] || field.defaultValue || ""}
                      onChange={(e) =>
                        setFormConfig({ ...formConfig, [field.name]: e.target.value })
                      }
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                    >
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type === "password" ? "password" : "text"}
                      placeholder={field.placeholder || ""}
                      value={
                        field.isSecret
                          ? formCredentials[field.name] || ""
                          : formConfig[field.name] || ""
                      }
                      onChange={(e) => {
                        if (field.isSecret) {
                          setFormCredentials({
                            ...formCredentials,
                            [field.name]: e.target.value,
                          });
                        } else {
                          setFormConfig({
                            ...formConfig,
                            [field.name]: e.target.value,
                          });
                        }
                      }}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 placeholder-neutral-500"
                    />
                  )}

                  {field.description && (
                    <p className="text-[10px] text-neutral-400">{field.description}</p>
                  )}
                </div>
              ))}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setActiveModalPlugin(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg transition-all"
                >
                  {submitting ? "Saving..." : "Save & Activate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
