"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  rateLimitPerMinute: number;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  isActive: boolean;
}

interface DeveloperOverview {
  activeCount: number;
  revokedCount: number;
  rateLimitTier: number;
  lastUsedAt: string | null;
  keys: ApiKeyItem[];
}

export function DeveloperView({ organizationId }: { organizationId: string }) {
  const [overview, setOverview] = useState<DeveloperOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Key creation state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["*"]);
  const [expiresInDays, setExpiresInDays] = useState<string>("never");
  const [creating, setCreating] = useState(false);

  // Reveal raw token state
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Active code snippet tab
  const [codeTab, setCodeTab] = useState<"curl" | "javascript" | "python">("curl");
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/v1/organizations/${organizationId}/api-keys`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || "Failed to load developer keys");
      }
      const data = await res.json();
      setOverview(data.data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch developer overview");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId) {
      void fetchKeys();
    }
  }, [organizationId]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return;

    try {
      setCreating(true);
      const payload: { name: string; scopes: string[]; expiresInDays?: number | null } = {
        name: keyName.trim(),
        scopes: selectedScopes,
      };

      if (expiresInDays !== "never") {
        payload.expiresInDays = parseInt(expiresInDays, 10);
      }

      const res = await fetch(`/api/v1/organizations/${organizationId}/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || "Failed to create API key");
      }

      const result = await res.json();
      setNewlyCreatedToken(result.data.rawToken);
      setIsCreateModalOpen(false);
      setKeyName("");
      setSelectedScopes(["*"]);
      setExpiresInDays("never");
      void fetchKeys();
    } catch (err: any) {
      alert(err.message || "Could not generate API key");
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeKey = async (keyId: string, name: string) => {
    if (
      !confirm(`Are you sure you want to revoke API key "${name}"? This action cannot be undone.`)
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/v1/organizations/${organizationId}/api-keys/${keyId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || "Failed to revoke key");
      }

      void fetchKeys();
    } catch (err: any) {
      alert(err.message || "Error revoking key");
    }
  };

  const toggleScope = (scope: string) => {
    if (scope === "*") {
      setSelectedScopes(["*"]);
      return;
    }
    const current = selectedScopes.filter((s) => s !== "*");
    if (current.includes(scope)) {
      const next = current.filter((s) => s !== scope);
      setSelectedScopes(next.length === 0 ? ["*"] : next);
    } else {
      setSelectedScopes([...current, scope]);
    }
  };

  const sampleToken = newlyCreatedToken || "gdn_live_xxxxxxxxxxxxxxxxxxxxxxxx";

  const getSnippets = () => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://useguardian.io";
    const healthUrl = `${origin}/api/v1/organizations/${organizationId}/health`;

    const curl = `curl -X GET "${healthUrl}" \\
  -H "Authorization: Bearer ${sampleToken}" \\
  -H "Content-Type: application/json"`;

    const js = `const response = await fetch("${healthUrl}", {
  headers: {
    "Authorization": "Bearer ${sampleToken}",
    "Content-Type": "application/json"
  }
});
const result = await response.json();
console.log("Health Score:", result.data.score);`;

    const py = `import requests

url = "${healthUrl}"
headers = {
    "Authorization": "Bearer ${sampleToken}",
    "Content-Type": "application/json"
}

response = requests.get(url, headers=headers)
data = response.json()
print("Health Score:", data["data"]["score"])`;

    return { curl, js, py };
  };

  const snippets = getSnippets();
  const currentSnippet =
    codeTab === "curl" ? snippets.curl : codeTab === "javascript" ? snippets.js : snippets.py;

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(currentSnippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const handleCopyToken = () => {
    if (newlyCreatedToken) {
      navigator.clipboard.writeText(newlyCreatedToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-on-surface">
              Developer & API Platform
            </h1>
            <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-400 border border-cyan-500/30">
              PRD §19 / v1
            </span>
          </div>
          <p className="mt-1 text-sm text-on-surface-variant">
            Programmatic REST API keys, SHA-256 tokens, OpenAPI specification, and rate-limited
            developer endpoints.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/api/v1/openapi.json"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl bg-surface-container-high/60 px-4 py-2 text-xs font-medium text-cyan-300 border border-cyan-500/30 hover:bg-surface-container-high transition"
          >
            <span>📜</span>
            <span>OpenAPI Spec (JSON)</span>
          </a>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 transition"
          >
            <span>+</span>
            <span>Generate API Key</span>
          </button>
        </div>
      </div>

      {/* Secret Reveal Banner (Shown once upon generation) */}
      {newlyCreatedToken && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5 backdrop-blur-md">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-amber-500/20 p-2 text-xl text-amber-400">🔑</div>
            <div className="flex-1 space-y-2">
              <h3 className="text-sm font-bold text-amber-300">API Key Generated Successfully</h3>
              <p className="text-xs text-on-surface-variant">
                This token will <strong className="text-amber-200">never be displayed again</strong>
                . Per PRD Section 20, Guardian stores only its cryptographic SHA-256 hash. Copy and
                save it immediately in your secrets manager.
              </p>
              <div className="flex items-center gap-2 rounded-xl bg-surface-container-lowest/90 p-2 border border-outline-variant font-mono text-xs">
                <span className="flex-1 select-all break-all text-cyan-300">
                  {newlyCreatedToken}
                </span>
                <button
                  onClick={handleCopyToken}
                  className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 transition"
                >
                  {copiedToken ? "Copied! ✓" : "Copy Secret"}
                </button>
              </div>
            </div>
            <button
              onClick={() => setNewlyCreatedToken(null)}
              className="text-on-surface-variant hover:text-on-surface text-sm"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GlassCard className="p-5" glow="cyan">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>Active API Keys</span>
            <span className="font-mono text-cyan-400">ACTIVE</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-on-surface">
              {overview?.activeCount ?? 0}
            </span>
            <span className="text-xs text-on-surface-variant">keys</span>
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">Active programmatic credentials</p>
        </GlassCard>

        <GlassCard className="p-5" glow="violet">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>Rate Limit Tier</span>
            <span className="font-mono text-purple-400">SLIDING WINDOW</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-on-surface">
              {overview?.rateLimitTier ?? 60}
            </span>
            <span className="text-xs text-on-surface-variant">req / min</span>
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">Plan-enforced token bucket</p>
        </GlassCard>

        <GlassCard className="p-5" glow="emerald">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>Authentication</span>
            <span className="font-mono text-emerald-400">RFC BEARER</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-emerald-400">SHA-256</span>
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">Zero plaintext storage</p>
        </GlassCard>

        <GlassCard className="p-5" glow={overview && overview.revokedCount > 0 ? "rose" : "none"}>
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>Revoked Keys</span>
            <span className="font-mono text-rose-400">REVOKED</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-on-surface">
              {overview?.revokedCount ?? 0}
            </span>
            <span className="text-xs text-on-surface-variant">keys</span>
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">Permanently invalidated tokens</p>
        </GlassCard>
      </div>

      {/* API Key Management Table */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between border-b border-outline-variant/40 pb-4">
          <div>
            <h2 className="text-base font-semibold text-on-surface">Active API Keys</h2>
            <p className="text-xs text-on-surface-variant">
              Manage cryptographic access tokens for your scripts, CI/CD pipelines, and internal
              tools.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-on-surface-variant animate-pulse">
            Loading API keys and telemetry...
          </div>
        ) : error ? (
          <div className="py-8 text-center text-xs text-rose-400">{error}</div>
        ) : !overview || overview.keys.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="text-3xl">🔑</div>
            <p className="text-sm font-medium text-on-surface">No API keys registered</p>
            <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
              Generate your first API key to connect external monitoring agents, automation
              webhooks, or custom portals.
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-2 rounded-xl bg-cyan-500/20 px-4 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/30 transition"
            >
              Generate First API Key
            </button>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-outline-variant/40 text-on-surface-variant">
                  <th className="py-3 px-4 font-semibold">Key Name</th>
                  <th className="py-3 px-4 font-semibold">Token Prefix</th>
                  <th className="py-3 px-4 font-semibold">Scopes</th>
                  <th className="py-3 px-4 font-semibold">Rate Limit</th>
                  <th className="py-3 px-4 font-semibold">Last Used</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {overview.keys.map((k) => (
                  <tr key={k.id} className="hover:bg-surface-container-high/30 transition">
                    <td className="py-3 px-4 font-medium text-on-surface">{k.name}</td>
                    <td className="py-3 px-4 font-mono text-cyan-300">{k.keyPrefix}...</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {k.scopes.map((s) => (
                          <span
                            key={s}
                            className="rounded bg-surface-container-high px-1.5 py-0.5 text-[10px] font-mono text-on-surface-variant"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-on-surface-variant">
                      {k.rateLimitPerMinute}/min
                    </td>
                    <td className="py-3 px-4 text-on-surface-variant">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "Never"}
                    </td>
                    <td className="py-3 px-4">
                      {k.isActive ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          ACTIVE
                        </span>
                      ) : k.revokedAt ? (
                        <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-400 border border-rose-500/20">
                          REVOKED
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-500/20">
                          EXPIRED
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {k.isActive && (
                        <button
                          onClick={() => handleRevokeKey(k.id, k.name)}
                          className="rounded-lg bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-300 hover:bg-rose-500/20 transition"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Interactive Code Snippets & Quickstarts */}
      <GlassCard className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-outline-variant/40 pb-4 gap-3">
          <div>
            <h2 className="text-base font-semibold text-on-surface">Interactive API Quickstarts</h2>
            <p className="text-xs text-on-surface-variant">
              Authenticate via standard HTTP headers using{" "}
              <code className="text-cyan-300">Authorization: Bearer &lt;TOKEN&gt;</code> or{" "}
              <code className="text-cyan-300">X-API-Key: &lt;TOKEN&gt;</code>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCodeTab("curl")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                codeTab === "curl"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              cURL
            </button>
            <button
              onClick={() => setCodeTab("javascript")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                codeTab === "javascript"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              JavaScript / TS
            </button>
            <button
              onClick={() => setCodeTab("python")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                codeTab === "python"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Python
            </button>
          </div>
        </div>

        <div className="mt-4 relative">
          <pre className="overflow-x-auto rounded-xl bg-surface-container-lowest p-4 text-xs font-mono text-cyan-200 border border-outline-variant/60">
            {currentSnippet}
          </pre>
          <button
            onClick={handleCopySnippet}
            className="absolute top-3 right-3 rounded-lg bg-surface-container-high/80 px-3 py-1 text-xs font-medium text-on-surface hover:bg-surface-container-high transition border border-outline-variant"
          >
            {copiedSnippet ? "Copied! ✓" : "Copy"}
          </button>
        </div>
      </GlassCard>

      {/* Modal: Generate New API Key */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-outline-variant bg-surface-container-high p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-3">
              <h3 className="text-base font-bold text-on-surface">Generate New API Key</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateKey} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-on-surface">Key Name / Identifier</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GitHub Actions CI, Zapier Webhook, Internal Dashboard"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface placeholder:text-on-surface-variant/40 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-on-surface">Expiration</label>
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface focus:border-cyan-500 focus:outline-none"
                >
                  <option value="never">Never (Persistent)</option>
                  <option value="30">30 Days</option>
                  <option value="90">90 Days</option>
                  <option value="365">1 Year (365 Days)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-on-surface mb-2">Permission Scopes</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "*", label: "* (Full Access)" },
                    { id: "health:read", label: "health:read" },
                    { id: "issues:read", label: "issues:read" },
                    { id: "issues:write", label: "issues:write" },
                    { id: "monitors:read", label: "monitors:read" },
                    { id: "monitors:write", label: "monitors:write" },
                    { id: "remediation:read", label: "remediation:read" },
                    { id: "agency:read", label: "agency:read" },
                  ].map((scope) => (
                    <label
                      key={scope.id}
                      className="flex items-center gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-lowest/50 p-2 cursor-pointer hover:bg-surface-container-lowest"
                    >
                      <input
                        type="checkbox"
                        checked={selectedScopes.includes(scope.id)}
                        onChange={() => toggleScope(scope.id)}
                        className="rounded border-outline-variant text-cyan-500 focus:ring-0"
                      />
                      <span className="font-mono text-[11px] text-on-surface">{scope.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant/40">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl px-4 py-2 font-medium text-on-surface-variant hover:text-on-surface"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !keyName.trim()}
                  className="rounded-xl bg-cyan-500 px-4 py-2 font-semibold text-neutral-900 hover:bg-cyan-400 transition disabled:opacity-50"
                >
                  {creating ? "Generating..." : "Generate Key"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
