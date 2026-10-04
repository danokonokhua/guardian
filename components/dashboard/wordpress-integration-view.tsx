"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";

interface WebsiteItem {
  id: string;
  hostname: string;
  label?: string | null;
}

interface WordpressConnectionData {
  id: string;
  siteUrl: string;
  tokenPrefix: string;
  status: "CONNECTED" | "SYNCING" | "ERROR" | "DISCONNECTED";
  wpVersion: string | null;
  phpVersion: string | null;
  serverSoftware: string | null;
  debugMode: boolean;
  httpsEnforced: boolean;
  updatesAvailable?: {
    core: number;
    plugins: number;
    themes: number;
  };
  plugins?: Array<{
    name: string;
    version: string;
    active: boolean;
    hasUpdate: boolean;
    updateVersion?: string;
    vulnerable?: boolean;
    vulnerabilityNotice?: string;
  }>;
  themes?: Array<{
    name: string;
    version: string;
    active: boolean;
    hasUpdate: boolean;
  }>;
  lastSyncAt: string | null;
  lastError: string | null;
  isSandbox: boolean;
}

export function WordpressIntegrationView({ organizationId }: { organizationId: string }) {
  const [websites, setWebsites] = useState<WebsiteItem[]>([]);
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string>("");
  const [connection, setConnection] = useState<WordpressConnectionData | null>(null);
  const [plan, setPlan] = useState<string>("PRO");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [showPairModal, setShowPairModal] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [reload, setReload] = useState(0);

  // 1. Fetch available websites for this organization
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/organizations/${organizationId}/websites`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load websites.");
        return r.json();
      })
      .then((body) => {
        if (!cancelled && body.data) {
          const list = Array.isArray(body.data) ? body.data : body.data.items || [];
          setWebsites(list);
          if (list.length > 0 && !selectedWebsiteId) {
            setSelectedWebsiteId(list[0].id);
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  // 2. Fetch WordPress connection for the selected website
  useEffect(() => {
    if (!selectedWebsiteId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetch(`/api/v1/organizations/${organizationId}/websites/${selectedWebsiteId}/wordpress`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load WordPress connection.");
        return r.json();
      })
      .then((body) => {
        if (!cancelled && body.data) {
          setConnection(body.data.connection);
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
  }, [organizationId, selectedWebsiteId, reload]);

  async function handleConnect(isSandbox = false) {
    if (!selectedWebsiteId) return;
    setBusy(true);
    setError(null);
    try {
      const selectedSite = websites.find((w) => w.id === selectedWebsiteId);
      const cleanHost = selectedSite?.hostname?.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
      const siteUrl = cleanHost ? `https://${cleanHost}` : undefined;

      const res = await fetch(
        `/api/v1/organizations/${organizationId}/websites/${selectedWebsiteId}/wordpress`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isSandbox, siteUrl }),
        },
      );

      const body = await res.json();
      if (!res.ok) {
        const errorMsg =
          body.error?.message ||
          (typeof body.error === "string" ? body.error : "Failed to initiate WordPress connection.");
        throw new Error(errorMsg);
      }

      setConnection(body.data.connection);
      if (body.data.token) {
        setGeneratedToken(body.data.token);
        if (!isSandbox) {
          setShowPairModal(true);
        }
      }
      setReload((r) => r + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSync(simulateFix = false) {
    if (!selectedWebsiteId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/organizations/${organizationId}/websites/${selectedWebsiteId}/wordpress/sync`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ simulateFix }),
        },
      );

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error?.message || "Sync probe failed.");
      }

      setConnection(body.data.connection);
      setReload((r) => r + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync probe failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    if (!selectedWebsiteId) return;
    if (
      !confirm("Are you sure you want to disconnect WordPress and remove associated telemetry?")
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/organizations/${organizationId}/websites/${selectedWebsiteId}/wordpress`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        throw new Error("Failed to disconnect.");
      }
      setConnection(null);
      setGeneratedToken(null);
      setReload((r) => r + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setBusy(false);
    }
  }

  const originUrl = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl = `${originUrl}/api/v1/integrations/wordpress/webhook`;

  if (loading && websites.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        <p className="mt-2 text-sm">Loading websites and connection status...</p>
      </div>
    );
  }

  if (websites.length === 0) {
    return (
      <GlassCard className="p-8 text-center">
        <h3 className="text-lg font-semibold text-white">No Websites Monitored</h3>
        <p className="mt-2 text-sm text-slate-400">
          Add a website to your organization first before connecting WordPress.
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Website Selector Dropdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-white/5 bg-slate-900/40">
        <div>
          <label className="text-xs uppercase tracking-wider font-semibold text-slate-400 block mb-1">
            Target Website
          </label>
          <select
            value={selectedWebsiteId}
            onChange={(e) => setSelectedWebsiteId(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            {websites.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label ? `${w.label} (${w.hostname})` : w.hostname}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-400">
          Plan: <span className="font-semibold text-emerald-400">{plan}</span>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Main Connection Card */}
      {!connection ? (
        <GlassCard className="p-8">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-lg">
                W
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Guardian Connect for WordPress</h3>
                <p className="text-xs text-slate-400">
                  Continuous security intelligence, core/plugin vulnerability detection, and runtime
                  observability.
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm text-slate-300 leading-relaxed">
              Connect your WordPress site to Guardian to automatically track core updates, PHP
              version status, installed plugins, active themes, and sensitive exposed configurations
              like{" "}
              <code className="text-amber-300 bg-amber-400/10 px-1 py-0.5 rounded">WP_DEBUG</code>.
              Vulnerabilities and outdated packages directly affect your{" "}
              <strong>Security Health Score</strong>.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                onClick={() => handleConnect(false)}
                disabled={busy}
                className="button-primary text-sm px-4 py-2"
              >
                {busy ? "Preparing Token..." : "Connect Live WordPress Site"}
              </button>

              <button
                onClick={() => handleConnect(true)}
                disabled={busy}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 transition-colors"
              >
                {busy ? "Connecting..." : "Connect Test Site (Sandbox Mode)"}
              </button>
            </div>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-6">
          {/* Header Card with Health Status */}
          <GlassCard className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-lg">
                  W
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-white">{connection.siteUrl}</h3>
                    {connection.isSandbox ? (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium">
                        Sandbox Demo
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Token Prefix:{" "}
                    <code className="text-slate-300">{connection.tokenPrefix}...</code> • Last
                    synced:{" "}
                    {connection.lastSyncAt
                      ? new Date(connection.lastSyncAt).toLocaleString()
                      : "Never"}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleSync(false)}
                  disabled={busy}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-colors"
                >
                  {busy ? "Syncing..." : "Sync Now"}
                </button>

                {connection.isSandbox && (
                  <button
                    onClick={() => handleSync(true)}
                    disabled={busy}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 transition-colors"
                    title="Simulate updating WordPress core, PHP, and disabling WP_DEBUG"
                  >
                    Simulate Fixes
                  </button>
                )}

                <button
                  onClick={handleDisconnect}
                  disabled={busy}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
              {/* Core Version */}
              <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-medium block">
                  WordPress Core
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-bold text-white">
                    {connection.wpVersion || "—"}
                  </span>
                  {connection.updatesAvailable?.core ? (
                    <span className="text-xs text-amber-400 font-medium">Update Needed</span>
                  ) : (
                    <span className="text-xs text-emerald-400 font-medium">Latest</span>
                  )}
                </div>
              </div>

              {/* PHP Version */}
              <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-medium block">
                  PHP Runtime
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-bold text-white">
                    {connection.phpVersion || "—"}
                  </span>
                  {connection.phpVersion && Number.parseFloat(connection.phpVersion) < 8.1 ? (
                    <span className="text-xs text-amber-400 font-medium">EOL</span>
                  ) : (
                    <span className="text-xs text-emerald-400 font-medium">Supported</span>
                  )}
                </div>
              </div>

              {/* WP_DEBUG */}
              <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-medium block">
                  Debug Mode
                </span>
                <div className="mt-1">
                  {connection.debugMode ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      ⚠ Active in Production
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ✓ Disabled (Secure)
                    </span>
                  )}
                </div>
              </div>

              {/* Total Updates */}
              <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-medium block">
                  Updates Available
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-bold text-white">
                    {(connection.updatesAvailable?.core || 0) +
                      (connection.updatesAvailable?.plugins || 0) +
                      (connection.updatesAvailable?.themes || 0)}
                  </span>
                  <span className="text-xs text-slate-400">
                    ({connection.updatesAvailable?.plugins || 0} plugins)
                  </span>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Installed Plugins Table */}
          {connection.plugins && connection.plugins.length > 0 && (
            <GlassCard className="p-6">
              <h4 className="text-sm uppercase tracking-wider font-semibold text-slate-300 mb-4">
                Installed Plugins ({connection.plugins.length})
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="border-b border-white/5 text-slate-400 uppercase">
                    <tr>
                      <th className="pb-3 font-medium">Plugin</th>
                      <th className="pb-3 font-medium">Version</th>
                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">Update</th>
                      <th className="pb-3 font-medium">Security Advisory</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {connection.plugins.map((plugin, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        <td className="py-3 font-medium text-white">{plugin.name}</td>
                        <td className="py-3 font-mono text-slate-400">v{plugin.version}</td>
                        <td className="py-3">
                          {plugin.active ? (
                            <span className="text-emerald-400">Active</span>
                          ) : (
                            <span className="text-slate-500">Inactive</span>
                          )}
                        </td>
                        <td className="py-3">
                          {plugin.hasUpdate ? (
                            <span className="text-amber-400 font-medium">
                              Update to {plugin.updateVersion || "latest"}
                            </span>
                          ) : (
                            <span className="text-slate-500">Up to date</span>
                          )}
                        </td>
                        <td className="py-3">
                          {plugin.vulnerable ? (
                            <span className="inline-flex items-center gap-1 text-rose-400 font-semibold bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded">
                              ⚠ {plugin.vulnerabilityNotice || "Vulnerability Flagged"}
                            </span>
                          ) : (
                            <span className="text-slate-500">No known CVEs</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}

          {/* Plugin Setup & Webhook Reference */}
          <GlassCard className="p-6">
            <h4 className="text-sm font-semibold text-white mb-2">
              WordPress Plugin Connection Details
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              To connect via the Guardian Connect WordPress plugin, enter the webhook endpoint and
              pairing token in your WordPress Admin (under <strong>Settings → Guardian Connect</strong>):
            </p>

            <div className="space-y-4 font-mono text-xs">
              <div>
                <span className="text-slate-400 block mb-1">Webhook Ingestion Endpoint:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 text-slate-200 select-all"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(webhookUrl);
                      setCopiedWebhook(true);
                      setTimeout(() => setCopiedWebhook(false), 2000);
                    }}
                    className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs shrink-0 transition-colors"
                  >
                    {copiedWebhook ? "✓ Copied" : "Copy"}
                  </button>
                </div>
              </div>

              {generatedToken ? (
                <div>
                  <span className="text-slate-400 block mb-1">Active Pairing Token:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedToken}
                      className="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 text-emerald-400 select-all"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedToken);
                        setCopiedToken(true);
                        setTimeout(() => setCopiedToken(false), 2000);
                      }}
                      className="px-3 py-2 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 text-xs shrink-0 transition-colors"
                    >
                      {copiedToken ? "✓ Copied" : "Copy Token"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-slate-900/60 border border-white/5 text-slate-400">
                  Token Prefix: <code className="text-emerald-400">{connection.tokenPrefix}...</code>
                  <p className="mt-1 text-[11px] text-slate-500 font-sans">
                    Pairing tokens are encrypted and only shown once upon connection. If you need a new token, click Disconnect and reconnect.
                  </p>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      )}

      {/* Modal for Pairing Instructions */}
      {showPairModal && generatedToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-w-md w-full rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">WordPress Pairing Key Generated</h3>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
              Copy this pairing token and paste it into your WordPress admin settings under{" "}
              <strong>Settings → Guardian Connect</strong>. This token is only shown once:
            </p>

            <div className="mt-4 p-3 rounded-lg bg-black/50 border border-white/10 font-mono text-xs text-emerald-400 break-all select-all">
              {generatedToken}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedToken);
                  setCopiedToken(true);
                  setTimeout(() => setCopiedToken(false), 2000);
                }}
                className="px-3 py-2 rounded-lg text-xs font-medium border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-colors"
              >
                {copiedToken ? "✓ Copied to Clipboard" : "Copy Token"}
              </button>
              <button
                onClick={() => setShowPairModal(false)}
                className="button-primary text-xs px-4 py-2"
              >
                I Have Saved My Token
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
