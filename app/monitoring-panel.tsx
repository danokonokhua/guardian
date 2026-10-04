"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DnsEvidence } from "@/components/dashboard/dns-evidence";
import { AccessibilityEvidence } from "@/components/dashboard/accessibility-evidence";
import type { AccessibilityConfig } from "@/lib/accessibility/types";
import { EmailHealthEvidence } from "@/components/dashboard/email-health-evidence";
import type { EmailHealthConfig } from "@/lib/email-health/types";
import {
  DomainExpiryEvidence,
  type ExpiryEvidence,
} from "@/components/dashboard/domain-expiry-evidence";

type Monitor = {
  id: string;
  websiteId: string;
  type: string;
  enabled: boolean;
  frequencyMinutes: number;
  config?: EmailHealthConfig &
    AccessibilityConfig & {
      thresholds?: number[];
      expiry?: ExpiryEvidence;
      lastSuccessful?: ExpiryEvidence;
      baseline?: Record<string, string[]>;
      latest?: Record<string, { state: string; records?: string[]; reason?: string }>;
      observedAt?: string;
    };
  results?: Array<{
    status: string;
    checkedAt: string;
    responseTimeMs: number | null;
    httpStatusCode: number | null;
  }>;
};

export type MonitorCategory =
  | "ALL"
  | "UPTIME_CORE"
  | "SECURITY_SSL"
  | "SEO_DOMAIN"
  | "PERFORMANCE"
  | "LEAD_GEN"
  | "COMPLIANCE";

export interface CategoryInfo {
  id: MonitorCategory;
  name: string;
  shortLabel: string;
  icon: string;
  description: string;
  types: string[];
}

export const MONITOR_CATEGORIES: CategoryInfo[] = [
  {
    id: "ALL",
    name: "All Checks",
    shortLabel: "All",
    icon: "📊",
    description: "Every configured check across all domains",
    types: [],
  },
  {
    id: "UPTIME_CORE",
    name: "Uptime & Availability",
    shortLabel: "Uptime",
    icon: "⏱️",
    description: "Ping, HTTP status, and real-time reachability",
    types: ["UPTIME"],
  },
  {
    id: "SECURITY_SSL",
    name: "Security & Certificates",
    shortLabel: "Security & SSL",
    icon: "🛡️",
    description: "SSL expiration, chain validity, and HTTP security headers",
    types: ["SSL", "SECURITY"],
  },
  {
    id: "SEO_DOMAIN",
    name: "SEO & Domain Integrity",
    shortLabel: "SEO & Domain",
    icon: "🔍",
    description: "Domain registration expiry, DNS baselines, and search indexability",
    types: ["SEO", "DOMAIN_EXPIRY", "DNS"],
  },
  {
    id: "PERFORMANCE",
    name: "Performance & Vitals",
    shortLabel: "Performance",
    icon: "⚡",
    description: "Page load speed, server latency, and response time thresholds",
    types: ["PERFORMANCE"],
  },
  {
    id: "LEAD_GEN",
    name: "Lead Flow & Conversion",
    shortLabel: "Lead Forms",
    icon: "📋",
    description: "Inbound lead form availability and broken link detection",
    types: ["FORM", "LINKS"],
  },
  {
    id: "COMPLIANCE",
    name: "Policy & Compliance",
    shortLabel: "Compliance",
    icon: "🌐",
    description: "WCAG accessibility guidelines and SPF/DMARC/MTA-STS email policies",
    types: ["ACCESSIBILITY", "EMAIL_HEALTH"],
  },
];

const monitorOptions = [
  { value: "ACCESSIBILITY", label: "Basic accessibility (HTML checks)" },
  { value: "EMAIL_HEALTH", label: "Email-domain health (SPF, DMARC, MTA-STS)" },
  { value: "DOMAIN_EXPIRY", label: "Domain registration expiry" },
  { value: "DNS", label: "DNS record changes" },
  { value: "UPTIME", label: "Website uptime" },
  { value: "SSL", label: "SSL certificate" },
  { value: "SECURITY", label: "Security headers" },
  { value: "LINKS", label: "Broken links" },
  { value: "SEO", label: "SEO" },
  { value: "PERFORMANCE", label: "Performance" },
  { value: "FORM", label: "Lead generation (forms)" },
] as const;

const futureMonitorOptions = [{ value: "REPUTATION", label: "Reputation (coming soon)" }] as const;

function monitorLabel(type: string): string {
  return (
    [...monitorOptions, ...futureMonitorOptions].find((option) => option.value === type)?.label ??
    type
  );
}

function getCategoryForType(type: string): CategoryInfo {
  return (
    MONITOR_CATEGORIES.slice(1).find((c) => c.types.includes(type)) ?? {
      id: "ALL",
      name: "General Monitoring",
      shortLabel: "General",
      icon: "🔍",
      description: "Standard monitoring check",
      types: [type],
    }
  );
}

function formatFrequency(minutes: number): string {
  if (minutes < 60) return `Every ${minutes}m`;
  if (minutes === 60) return "Hourly";
  if (minutes % 60 === 0 && minutes < 1440) return `Every ${minutes / 60}h`;
  if (minutes === 1440) return "Daily (24h)";
  return `${minutes} min`;
}

type Website = {
  id: string;
  hostname: string;
  label: string | null;
  verifyStatus?: string;
  verifyToken?: string | null;
};

async function parseApiError(response: Response, defaultFallback: string): Promise<string> {
  try {
    const data = await response.json();
    if (data?.error?.message) return data.error.message;
    if (typeof data?.error === "string") return data.error;
    if (data?.message) return data.message;
  } catch {
    // Non-JSON response
  }
  const requestId = response.headers.get("x-request-id");
  return requestId ? `${defaultFallback} (request ${requestId})` : defaultFallback;
}

export function MonitoringPanel({ organizationId }: { organizationId: string }) {
  const [result, setResult] = useState<{ organizationId: string; monitors: Monitor[] } | null>(
    null,
  );
  const [error, setError] = useState<{ organizationId: string; message: string } | null>(null);
  const [websites, setWebsites] = useState<{ organizationId: string; data: Website[] } | null>(
    null,
  );
  const [reloadToken, setReloadToken] = useState(0);

  // Filters
  const [selectedWebsiteFilter, setSelectedWebsiteFilter] = useState<string>("ALL");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<MonitorCategory>("ALL");

  // Form State
  const [websiteId, setWebsiteId] = useState("");
  const [type, setType] = useState<Monitor["type"]>("UPTIME");
  const [frequencyMinutes, setFrequencyMinutes] = useState("5");
  const [frequencyDrafts, setFrequencyDrafts] = useState<Record<string, string>>({});
  const [formId, setFormId] = useState("");
  const [emailDomainScope, setEmailDomainScope] = useState("REGISTERED");
  const [formPagePath, setFormPagePath] = useState("");
  const [formProbePath, setFormProbePath] = useState("");

  // Feedback & Loading
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [runningMonitorId, setRunningMonitorId] = useState<string | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [websiteSubmitting, setWebsiteSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/organizations/${organizationId}/monitors`)
      .then(async (response) => {
        if (!response.ok) {
          const err = await parseApiError(response, "Unable to load monitors");
          throw new Error(err);
        }
        return (await response.json()) as { data: Monitor[] };
      })
      .then((res) => {
        if (!cancelled) {
          setError(null);
          setResult({ organizationId, monitors: res.data });
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError({
            organizationId,
            message: cause instanceof Error ? cause.message : "Unable to load monitors",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, reloadToken]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/organizations/${organizationId}/websites`)
      .then(async (response) => {
        if (!response.ok) {
          const err = await parseApiError(response, "Unable to load websites");
          throw new Error(err);
        }
        return (await response.json()) as { data: Website[] };
      })
      .then((res) => {
        if (!cancelled) {
          setWebsites({ organizationId, data: res.data });
          const firstSite = res.data[0];
          if (!websiteId && firstSite) {
            setWebsiteId(firstSite.id);
          }
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setActionError(cause instanceof Error ? cause.message : "Unable to load websites");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, reloadToken, websiteId]);

  const availableWebsites = websites?.organizationId === organizationId ? websites.data : [];

  function getWebsiteInfo(id: string) {
    const site = availableWebsites.find((w) => w.id === id);
    if (!site) {
      return {
        id,
        hostname: id,
        label: null,
        displayName: `Website (${id.slice(0, 8)}…)`,
        isVerified: false,
      };
    }
    const displayName = site.label ? `${site.label} (${site.hostname})` : site.hostname;
    return {
      id: site.id,
      hostname: site.hostname,
      label: site.label,
      displayName,
      isVerified: site.verifyStatus === "VERIFIED",
    };
  }

  // Pre-configured monitor types for current website selection in form
  const configuredTypesForFormWebsite = new Set(
    (result?.monitors ?? []).filter((m) => m.websiteId === websiteId).map((m) => m.type),
  );

  const isCurrentTypeAlreadyConfigured = Boolean(
    websiteId && configuredTypesForFormWebsite.has(type),
  );

  async function createMonitor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setActionError(null);
    setActionSuccess(null);

    if (isCurrentTypeAlreadyConfigured) {
      setActionError(
        `A ${monitorLabel(type)} check is already active for this website. To change timing or settings, edit the existing card below.`,
      );
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`/api/v1/organizations/${organizationId}/monitors`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          websiteId,
          type,
          frequencyMinutes: Number(frequencyMinutes),
          enabled: true,
          config:
            type === "FORM"
              ? {
                  formId: formId.trim(),
                  ...(formPagePath.trim() === "" ? {} : { pagePath: formPagePath.trim() }),
                  ...(formProbePath.trim() === "" ? {} : { probePath: formProbePath.trim() }),
                }
              : type === "EMAIL_HEALTH"
                ? { domainScope: emailDomainScope }
                : {},
        }),
      });

      if (!response.ok) {
        const errorMsg = await parseApiError(response, "Unable to create monitor");
        throw new Error(errorMsg);
      }

      setFormId("");
      setFormPagePath("");
      setFormProbePath("");
      setActionSuccess(`${monitorLabel(type)} check configured successfully!`);
      setReloadToken((value) => value + 1);
    } catch (cause: unknown) {
      setActionError(cause instanceof Error ? cause.message : "Unable to create monitor");
    } finally {
      setSubmitting(false);
    }
  }

  async function onboardWebsite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWebsiteSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const response = await fetch(`/api/v1/organizations/${organizationId}/websites`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: websiteUrl, businessName: businessName || undefined }),
      });
      if (!response.ok) {
        const errorMsg = await parseApiError(response, "Unable to add website");
        throw new Error(errorMsg);
      }
      setWebsiteUrl("");
      setBusinessName("");
      setActionSuccess("Website added successfully! You can now configure monitoring checks.");
      setReloadToken((value) => value + 1);
    } catch (cause: unknown) {
      setActionError(cause instanceof Error ? cause.message : "Unable to add website");
    } finally {
      setWebsiteSubmitting(false);
    }
  }

  async function verifyWebsite(website: Website) {
    setActionError(null);
    setActionSuccess(null);
    try {
      const response = await fetch(
        `/api/v1/organizations/${organizationId}/websites/${website.id}/verify`,
        { method: "POST" },
      );
      if (!response.ok) {
        const errorMsg = await parseApiError(response, "Unable to verify website");
        throw new Error(errorMsg);
      }
      setActionSuccess(`Verification checked for ${website.label || website.hostname}.`);
      setReloadToken((value) => value + 1);
    } catch (cause: unknown) {
      setActionError(cause instanceof Error ? cause.message : "Unable to verify website");
    }
  }

  async function acceptDnsBaseline(monitor: Monitor) {
    if (
      !window.confirm(
        "Accept the displayed DNS records as the new baseline? Review all changes first.",
      )
    )
      return;
    setActionError(null);
    setActionSuccess(null);
    try {
      const response = await fetch(
        `/api/v1/organizations/${organizationId}/monitors/${monitor.id}/dns-baseline`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ observedAt: monitor.config?.observedAt }),
        },
      );
      if (!response.ok) {
        const errorMsg = await parseApiError(
          response,
          "Unable to accept baseline. Refresh and check the latest DNS evidence.",
        );
        throw new Error(errorMsg);
      }
      setActionSuccess("DNS baseline successfully recorded.");
      setReloadToken((value) => value + 1);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to accept baseline");
    }
  }

  async function updateMonitor(monitor: Monitor, enabled: boolean) {
    setActionError(null);
    setActionSuccess(null);
    try {
      const response = await fetch(
        `/api/v1/organizations/${organizationId}/monitors/${monitor.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ enabled }),
        },
      );
      if (!response.ok) {
        const errorMsg = await parseApiError(response, "Unable to update monitor");
        throw new Error(errorMsg);
      }
      setActionSuccess(
        `${monitorLabel(monitor.type)} ${enabled ? "activated" : "paused"} successfully.`,
      );
      setReloadToken((value) => value + 1);
    } catch (cause: unknown) {
      setActionError(cause instanceof Error ? cause.message : "Unable to update monitor");
    }
  }

  async function changeFrequency(monitor: Monitor) {
    const value = Number(frequencyDrafts[monitor.id] ?? monitor.frequencyMinutes);
    if (!Number.isInteger(value) || value < 1 || value > 1440) {
      setActionError("Frequency must be a whole number between 1 and 1440 minutes.");
      return;
    }
    setActionError(null);
    setActionSuccess(null);
    try {
      const response = await fetch(
        `/api/v1/organizations/${organizationId}/monitors/${monitor.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ frequencyMinutes: value }),
        },
      );
      if (!response.ok) {
        const errorMsg = await parseApiError(response, "Unable to update monitor frequency");
        throw new Error(errorMsg);
      }
      setActionSuccess(
        `Frequency for ${monitorLabel(monitor.type)} updated to every ${formatFrequency(value)}.`,
      );
      setReloadToken((current) => current + 1);
    } catch (cause: unknown) {
      setActionError(cause instanceof Error ? cause.message : "Unable to update monitor frequency");
    }
  }

  async function removeMonitor(monitor: Monitor) {
    if (!window.confirm(`Remove the ${monitorLabel(monitor.type)} monitor?`)) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      const response = await fetch(
        `/api/v1/organizations/${organizationId}/monitors/${monitor.id}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const errorMsg = await parseApiError(response, "Unable to remove monitor");
        throw new Error(errorMsg);
      }
      setActionSuccess(`${monitorLabel(monitor.type)} check removed.`);
      setReloadToken((current) => current + 1);
    } catch (cause: unknown) {
      setActionError(cause instanceof Error ? cause.message : "Unable to remove monitor");
    }
  }

  async function runMonitor(monitor: Monitor) {
    setActionError(null);
    setActionSuccess(null);
    setRunningMonitorId(monitor.id);
    try {
      const response = await fetch(
        `/api/v1/organizations/${organizationId}/monitors/${monitor.id}/run`,
        { method: "POST" },
      );
      if (!response.ok) {
        const errorMsg = await parseApiError(response, "Unable to run monitor");
        throw new Error(errorMsg);
      }
      setActionSuccess(
        `Check queued! "${monitorLabel(monitor.type)}" is running in the background.`,
      );
    } catch (cause: unknown) {
      setActionError(cause instanceof Error ? cause.message : "Unable to run monitor");
    } finally {
      setRunningMonitorId(null);
    }
  }

  if (error?.organizationId === organizationId) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-900/80 bg-red-950/50 p-5 text-sm text-red-300 shadow-lg backdrop-blur-sm"
      >
        <div className="flex items-center gap-2 font-medium text-red-200">
          <span>⚠️</span> Error Loading Monitoring Checks
        </div>
        <p className="mt-1">{error.message}</p>
      </div>
    );
  }

  if (result?.organizationId !== organizationId) {
    return <p className="p-4 text-sm text-neutral-400">Loading monitoring checks…</p>;
  }

  const allMonitors = result.monitors;

  // Filter monitors
  const filteredMonitors = allMonitors.filter((monitor) => {
    if (selectedWebsiteFilter !== "ALL" && monitor.websiteId !== selectedWebsiteFilter) {
      return false;
    }
    if (selectedCategoryFilter !== "ALL") {
      const cat = MONITOR_CATEGORIES.find((c) => c.id === selectedCategoryFilter);
      if (cat && !cat.types.includes(monitor.type)) {
        return false;
      }
    }
    return true;
  });

  // Calculate stats
  const activeCount = allMonitors.filter((m) => m.enabled).length;
  const pausedCount = allMonitors.filter((m) => !m.enabled).length;
  const sitesCount = new Set(allMonitors.map((m) => m.websiteId)).size;

  return (
    <div className="space-y-6">
      {/* Alert Notifications */}
      {actionError !== null && (
        <div
          role="alert"
          className="rounded-xl border border-rose-900/60 bg-rose-950/40 p-4 text-sm text-rose-200 shadow-md backdrop-blur-sm flex items-start justify-between gap-3"
        >
          <div className="flex items-start gap-2.5">
            <span className="text-rose-400 text-base leading-none mt-0.5">⚠️</span>
            <div>
              <p className="font-medium text-rose-100">Action Failed</p>
              <p className="mt-0.5 text-rose-200/90">{actionError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-rose-400 hover:text-rose-200 transition text-xs font-semibold px-2 py-1 rounded"
          >
            Dismiss
          </button>
        </div>
      )}

      {actionSuccess !== null && (
        <div
          role="status"
          className="rounded-xl border border-emerald-900/60 bg-emerald-950/40 p-4 text-sm text-emerald-200 shadow-md backdrop-blur-sm flex items-start justify-between gap-3"
        >
          <div className="flex items-start gap-2.5">
            <span className="text-emerald-400 text-base leading-none mt-0.5">✓</span>
            <div>
              <p className="font-medium text-emerald-100">Success</p>
              <p className="mt-0.5 text-emerald-200/90">{actionSuccess}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-emerald-400 hover:text-emerald-200 transition text-xs font-semibold px-2 py-1 rounded"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Overview Metric Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3.5 backdrop-blur-sm">
          <p className="text-xs font-medium text-neutral-400">Total Checks</p>
          <p className="mt-1 text-2xl font-bold text-neutral-100">{allMonitors.length}</p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3.5 backdrop-blur-sm">
          <p className="text-xs font-medium text-neutral-400">Active Checks</p>
          <p className="mt-1 text-2xl font-bold text-emerald-400">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3.5 backdrop-blur-sm">
          <p className="text-xs font-medium text-neutral-400">Paused Checks</p>
          <p className="mt-1 text-2xl font-bold text-neutral-400">{pausedCount}</p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3.5 backdrop-blur-sm">
          <p className="text-xs font-medium text-neutral-400">Websites Monitored</p>
          <p className="mt-1 text-2xl font-bold text-cyan-400">{sitesCount}</p>
        </div>
      </div>

      {/* Website Verification Notice */}
      {availableWebsites.length > 0 &&
        availableWebsites.some((website) => website.verifyStatus !== "VERIFIED") && (
          <div className="rounded-xl border border-amber-900/60 bg-amber-950/30 p-4 text-sm text-amber-200 backdrop-blur-sm space-y-3">
            {availableWebsites
              .filter((website) => website.verifyStatus !== "VERIFIED")
              .map((website) => (
                <div key={website.id} className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400">⚡</span>
                    <span>
                      Verify <strong>{website.label || website.hostname}</strong> by placing token{" "}
                      <code className="rounded bg-neutral-950 px-2 py-0.5 text-xs font-mono text-amber-300 border border-amber-800/60">
                        {website.verifyToken}
                      </code>{" "}
                      at <code>/.well-known/guardian-verification.txt</code>.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void verifyWebsite(website)}
                    className="rounded-lg border border-amber-700 bg-amber-900/40 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-800/60 transition shadow-sm"
                  >
                    Verify now
                  </button>
                </div>
              ))}
          </div>
        )}

      {/* Filters Bar: Websites & Categories */}
      {allMonitors.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-4 backdrop-blur-md">
          {/* Website Filter Tabs */}
          {availableWebsites.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-neutral-800/60">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mr-1">
                Website:
              </span>
              <button
                type="button"
                onClick={() => setSelectedWebsiteFilter("ALL")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  selectedWebsiteFilter === "ALL"
                    ? "bg-cyan-500 text-neutral-950 shadow-sm"
                    : "bg-neutral-800/70 text-neutral-300 hover:bg-neutral-800 hover:text-white"
                }`}
              >
                All Sites ({allMonitors.length})
              </button>
              {availableWebsites.map((site) => {
                const count = allMonitors.filter((m) => m.websiteId === site.id).length;
                return (
                  <button
                    key={site.id}
                    type="button"
                    onClick={() => setSelectedWebsiteFilter(site.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                      selectedWebsiteFilter === site.id
                        ? "bg-cyan-500 text-neutral-950 shadow-sm"
                        : "bg-neutral-800/70 text-neutral-300 hover:bg-neutral-800 hover:text-white"
                    }`}
                  >
                    <span>🌐</span>
                    <span>{site.label || site.hostname}</span>
                    <span className="opacity-75 text-[11px]">({count})</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mr-1">
              Category:
            </span>
            {MONITOR_CATEGORIES.map((category) => {
              const count =
                category.id === "ALL"
                  ? (selectedWebsiteFilter === "ALL"
                      ? allMonitors
                      : allMonitors.filter((m) => m.websiteId === selectedWebsiteFilter)
                    ).length
                  : (selectedWebsiteFilter === "ALL"
                      ? allMonitors
                      : allMonitors.filter((m) => m.websiteId === selectedWebsiteFilter)
                    ).filter((m) => category.types.includes(m.type)).length;

              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategoryFilter(category.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    selectedCategoryFilter === category.id
                      ? "bg-neutral-100 text-neutral-950 shadow-sm"
                      : "bg-neutral-800/60 text-neutral-300 hover:bg-neutral-800 hover:text-white"
                  }`}
                >
                  <span>{category.icon}</span>
                  <span>{category.shortLabel}</span>
                  <span className="opacity-75 text-[11px]">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Monitor Cards List */}
      {allMonitors.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/30 p-8 text-center backdrop-blur-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-800/60 text-xl">
            🛡️
          </div>
          <h3 className="mt-3 text-base font-semibold text-neutral-200">
            No monitoring checks configured yet.
          </h3>
          <p className="mt-1 text-sm text-neutral-400 max-w-md mx-auto">
            Add your domain uptime, SSL expiration, DNS change detection, and lead form monitoring
            using the form below.
          </p>
        </div>
      ) : filteredMonitors.length === 0 ? (
        <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/30 p-8 text-center backdrop-blur-sm">
          <p className="text-sm text-neutral-400">
            No checks match the current filter selection.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedWebsiteFilter("ALL");
              setSelectedCategoryFilter("ALL");
            }}
            className="mt-3 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700 transition"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {filteredMonitors.map((monitor) => {
            const siteInfo = getWebsiteInfo(monitor.websiteId);
            const category = getCategoryForType(monitor.type);

            return (
              <li
                key={monitor.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-neutral-800/90 bg-neutral-900/50 p-5 shadow-lg backdrop-blur-xl transition hover:border-neutral-700/80 hover:shadow-cyan-500/5"
              >
                <div>
                  {/* Card Header: Website & Category Badge + Status Capsule */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800/80 pb-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Prominent Website Pill */}
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-neutral-800/90 px-2.5 py-1 text-xs font-semibold text-neutral-200 border border-neutral-700/60">
                        <svg
                          className="h-3.5 w-3.5 text-cyan-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                          />
                        </svg>
                        <span>{siteInfo.displayName}</span>
                      </span>

                      {/* Category Badge */}
                      <span className="inline-flex items-center gap-1 rounded-md bg-neutral-900/90 border border-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
                        <span>{category.icon}</span>
                        <span>{category.shortLabel}</span>
                      </span>
                    </div>

                    {/* Status badge: Enabled / Paused */}
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                        monitor.enabled
                          ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/50"
                          : "bg-neutral-800 text-neutral-400 border border-neutral-700"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          monitor.enabled ? "bg-emerald-400 animate-pulse" : "bg-neutral-500"
                        }`}
                      />
                      {monitor.enabled ? "Enabled" : "Paused"}
                    </span>
                  </div>

                  {/* Title & Domain */}
                  <div className="mt-3">
                    <h3 className="text-base font-semibold text-neutral-100">
                      {monitorLabel(monitor.type)}
                    </h3>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      Monitoring domain:{" "}
                      <span className="font-mono text-neutral-300">{siteInfo.hostname}</span>
                    </p>
                  </div>

                  {/* Specialized Evidence Blocks */}
                  {monitor.type === "DNS" && (
                    <div className="mt-3">
                      <DnsEvidence
                        evidence={monitor.config}
                        onAccept={() => acceptDnsBaseline(monitor)}
                      />
                    </div>
                  )}
                  {monitor.type === "EMAIL_HEALTH" && (
                    <div className="mt-3">
                      <EmailHealthEvidence config={monitor.config} />
                    </div>
                  )}
                  {monitor.type === "ACCESSIBILITY" && (
                    <div className="mt-3">
                      <AccessibilityEvidence config={monitor.config} />
                    </div>
                  )}
                  {monitor.type === "DOMAIN_EXPIRY" && (
                    <div className="mt-3">
                      <DomainExpiryEvidence
                        evidence={monitor.config?.expiry}
                        lastSuccessful={monitor.config?.lastSuccessful}
                        thresholds={monitor.config?.thresholds}
                        onSave={async (thresholds) => {
                          const response = await fetch(
                            `/api/v1/organizations/${organizationId}/monitors/${monitor.id}`,
                            {
                              method: "PATCH",
                              headers: { "content-type": "application/json" },
                              body: JSON.stringify({ config: { thresholds } }),
                            },
                          );
                          if (!response.ok) throw Error("Unable to save expiry thresholds");
                          setActionSuccess("Domain expiry thresholds saved.");
                          setReloadToken((value) => value + 1);
                        }}
                      />
                    </div>
                  )}

                  {/* Last Run Result Status */}
                  {monitor.results?.[0] && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-neutral-950/60 p-2.5 text-xs border border-neutral-800/80">
                      <span className="text-neutral-500 font-medium">Last Result:</span>
                      <span
                        className={`font-semibold ${
                          monitor.results[0].status === "UP" ||
                          monitor.results[0].status === "PASS" ||
                          monitor.results[0].status === "OK"
                            ? "text-emerald-400"
                            : monitor.results[0].status === "DEGRADED"
                              ? "text-amber-400"
                              : "text-rose-400"
                        }`}
                      >
                        {monitor.results[0].status}
                      </span>
                      {monitor.results[0].httpStatusCode !== null && (
                        <span className="text-neutral-400 font-mono">
                          HTTP {monitor.results[0].httpStatusCode}
                        </span>
                      )}
                      {monitor.results[0].responseTimeMs !== null && (
                        <span className="text-neutral-400">
                          · {monitor.results[0].responseTimeMs} ms
                        </span>
                      )}
                      <span className="text-neutral-500 ml-auto">
                        {new Date(monitor.results[0].checkedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Controls & Footer */}
                <div className="mt-4 pt-3 border-t border-neutral-800/70">
                  {/* Frequency Settings */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs text-neutral-400 flex items-center gap-2">
                      <span>Runs every (minutes)</span>
                      <input
                        aria-label={`Frequency for ${monitorLabel(monitor.type)}`}
                        type="number"
                        min={
                          ["DOMAIN_EXPIRY", "EMAIL_HEALTH", "ACCESSIBILITY"].includes(monitor.type)
                            ? 60
                            : 1
                        }
                        max={1440}
                        value={frequencyDrafts[monitor.id] ?? String(monitor.frequencyMinutes)}
                        onChange={(event) =>
                          setFrequencyDrafts((current) => ({
                            ...current,
                            [monitor.id]: event.target.value,
                          }))
                        }
                        className="w-20 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-100 text-center font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </label>
                    <button
                      type="button"
                      className="rounded-md border border-neutral-700 bg-neutral-800/80 px-3 py-1 text-xs font-medium text-neutral-200 hover:bg-neutral-700 transition"
                      onClick={() => void changeFrequency(monitor)}
                    >
                      Save timing
                    </button>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700 transition"
                        onClick={() => void updateMonitor(monitor, !monitor.enabled)}
                      >
                        {monitor.enabled ? "Pause" : "Enable"}
                      </button>
                      <button
                        type="button"
                        disabled={runningMonitorId === monitor.id}
                        className="rounded-lg border border-neutral-700 bg-neutral-800/60 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700 transition disabled:opacity-50"
                        onClick={() => void runMonitor(monitor)}
                      >
                        {runningMonitorId === monitor.id ? "Queuing…" : "Run now"}
                      </button>
                    </div>
                    <button
                      type="button"
                      className="rounded-lg border border-rose-900/60 bg-rose-950/20 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-900/40 transition"
                      onClick={() => void removeMonitor(monitor)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Website Onboarding (if no websites yet) */}
      {availableWebsites.length === 0 && (
        <form
          onSubmit={(event) => void onboardWebsite(event)}
          className="rounded-2xl border border-neutral-800/90 bg-neutral-900/60 p-6 backdrop-blur-xl shadow-lg"
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">🌐</span>
            <h3 className="font-semibold text-lg text-neutral-100">Add your first website</h3>
          </div>
          <p className="mt-1 text-sm text-neutral-400">
            Guardian will monitor uptime, security certificates, DNS changes, and lead forms on this
            site.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr_auto]">
            <label className="text-xs font-medium text-neutral-300">
              Website URL
              <input
                required
                type="url"
                value={websiteUrl}
                onChange={(event) => setWebsiteUrl(event.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3.5 py-2 text-sm text-neutral-100 focus:border-cyan-500 focus:outline-none placeholder:text-neutral-600"
                placeholder="https://example.com"
              />
            </label>
            <label className="text-xs font-medium text-neutral-300">
              Business name (optional)
              <input
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3.5 py-2 text-sm text-neutral-100 focus:border-cyan-500 focus:outline-none placeholder:text-neutral-600"
                placeholder="My Business"
              />
            </label>
            <button
              type="submit"
              disabled={websiteSubmitting}
              className="self-end rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-neutral-950 hover:bg-emerald-400 transition shadow-md disabled:opacity-50"
            >
              {websiteSubmitting ? "Adding…" : "Add website"}
            </button>
          </div>
        </form>
      )}

      {/* Add a Monitoring Check Form */}
      <form
        onSubmit={(event) => void createMonitor(event)}
        className="rounded-2xl border border-neutral-800/90 bg-neutral-900/60 p-6 backdrop-blur-xl shadow-lg space-y-4"
      >
        <div className="flex items-center justify-between gap-3 border-b border-neutral-800/70 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-950/60 border border-cyan-800/50 text-cyan-400">
              +
            </span>
            <div>
              <h3 className="font-semibold text-base text-neutral-100">Add a monitoring check</h3>
              <p className="text-xs text-neutral-400">
                Choose the website and category of check you want Guardian to guard.
              </p>
            </div>
          </div>
        </div>

        {/* Duplicate Check Warning */}
        {isCurrentTypeAlreadyConfigured && (
          <div className="rounded-lg border border-amber-900/60 bg-amber-950/30 p-3 text-xs text-amber-300 flex items-center gap-2">
            <span>⚠️</span>
            <span>
              A <strong>{monitorLabel(type)}</strong> monitor is already active for this website. To
              adjust its frequency or settings, use the card above.
            </span>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-[2fr_2fr_1fr_auto]">
          <label className="text-xs font-medium text-neutral-300">
            Website
            <select
              required
              aria-label="Website"
              value={websiteId}
              onChange={(event) => setWebsiteId(event.target.value)}
              disabled={availableWebsites.length === 0}
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3.5 py-2 text-sm text-neutral-100 focus:border-cyan-500 focus:outline-none disabled:opacity-50"
            >
              <option value="">Select a website</option>
              {availableWebsites.map((website) => (
                <option key={website.id} value={website.id}>
                  {website.label ? `${website.label} (${website.hostname})` : website.hostname}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-neutral-300">
            Check type
            <select
              aria-label="Check type"
              value={type}
              onChange={(event) => {
                const nextType = event.target.value as Monitor["type"];
                setType(nextType);
                if (["DOMAIN_EXPIRY", "EMAIL_HEALTH", "ACCESSIBILITY"].includes(nextType)) {
                  setFrequencyMinutes("1440");
                }
              }}
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3.5 py-2 text-sm text-neutral-100 focus:border-cyan-500 focus:outline-none"
            >
              {monitorOptions.map((option) => {
                const isConfigured = Boolean(
                  websiteId && configuredTypesForFormWebsite.has(option.value),
                );
                return (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={isConfigured}
                    className={isConfigured ? "text-neutral-500" : ""}
                  >
                    {isConfigured ? `${option.label} (Already configured)` : option.label}
                  </option>
                );
              })}
              {futureMonitorOptions.map((option) => (
                <option key={option.value} value={option.value} disabled>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium text-neutral-300">
            Frequency (min)
            <input
              required
              aria-label="Frequency (min)"
              min={["DOMAIN_EXPIRY", "EMAIL_HEALTH", "ACCESSIBILITY"].includes(type) ? 60 : 1}
              max={1440}
              type="number"
              value={frequencyMinutes}
              onChange={(event) => setFrequencyMinutes(event.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 text-center font-mono focus:border-cyan-500 focus:outline-none"
            />
          </label>

          <button
            type="submit"
            disabled={
              submitting ||
              availableWebsites.length === 0 ||
              isCurrentTypeAlreadyConfigured ||
              (type === "FORM" && formId.trim() === "")
            }
            className="self-end rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-emerald-400 transition shadow-md disabled:opacity-50"
          >
            {submitting ? "Adding…" : "Add check"}
          </button>
        </div>

        {/* Quick Frequency Presets */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-400">
          <span className="text-[11px] uppercase tracking-wider text-neutral-500 mr-1">
            Presets:
          </span>
          <button
            type="button"
            disabled={["DOMAIN_EXPIRY", "EMAIL_HEALTH", "ACCESSIBILITY"].includes(type)}
            onClick={() => setFrequencyMinutes("5")}
            className="rounded px-2 py-0.5 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 disabled:opacity-40"
          >
            5m (Uptime)
          </button>
          <button
            type="button"
            disabled={["DOMAIN_EXPIRY", "EMAIL_HEALTH", "ACCESSIBILITY"].includes(type)}
            onClick={() => setFrequencyMinutes("15")}
            className="rounded px-2 py-0.5 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 disabled:opacity-40"
          >
            15m (Normal)
          </button>
          <button
            type="button"
            onClick={() => setFrequencyMinutes("60")}
            className="rounded px-2 py-0.5 bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
          >
            60m (Hourly)
          </button>
          <button
            type="button"
            onClick={() => setFrequencyMinutes("1440")}
            className="rounded px-2 py-0.5 bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
          >
            1440m (Daily)
          </button>
        </div>

        {/* Dynamic Contextual Inputs */}
        {type === "ACCESSIBILITY" && (
          <p className="rounded-lg bg-neutral-950/60 p-3 text-xs text-neutral-400 border border-neutral-800/80">
            Checks one verified page’s server-delivered HTML against WCAG accessibility standards. No
            JavaScript or CSS is executed.
          </p>
        )}

        {type === "EMAIL_HEALTH" && (
          <label className="block text-xs font-medium text-neutral-300">
            Email policy domain
            <select
              value={emailDomainScope}
              onChange={(event) => setEmailDomainScope(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3.5 py-2 text-sm text-neutral-100 focus:border-cyan-500 focus:outline-none"
            >
              <option value="REGISTERED">Registered domain (example.com)</option>
              <option value="HOSTNAME">Exact verified hostname (mail.example.com)</option>
            </select>
          </label>
        )}

        {type === "FORM" && (
          <div className="grid gap-3 md:grid-cols-3 rounded-lg bg-neutral-950/60 p-3 border border-neutral-800/80">
            <label className="text-xs font-medium text-neutral-300">
              Form ID or name
              <input
                required
                value={formId}
                onChange={(event) => setFormId(event.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100 focus:border-cyan-500 focus:outline-none placeholder:text-neutral-600"
                placeholder="contact-form"
              />
            </label>
            <label className="text-xs font-medium text-neutral-300">
              Page path (optional)
              <input
                value={formPagePath}
                onChange={(event) => setFormPagePath(event.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100 focus:border-cyan-500 focus:outline-none placeholder:text-neutral-600"
                placeholder="/contact"
              />
            </label>
            <label className="text-xs font-medium text-neutral-300">
              Safe probe path (optional)
              <input
                value={formProbePath}
                onChange={(event) => setFormProbePath(event.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100 focus:border-cyan-500 focus:outline-none placeholder:text-neutral-600"
                placeholder="/api/lead-health"
              />
            </label>
            <p className="md:col-span-3 text-xs text-neutral-500">
              Guardian confirms the server-rendered form exists on the page. If a probe path is
              supplied, it sends a same-origin HEAD probe; customer lead data is never submitted.
            </p>
          </div>
        )}

        <p className="text-xs text-neutral-500 pt-1">
          Lead generation measures the availability of a configured lead form without submitting
          customer data. Reputation is visible for roadmap clarity and remains disabled until the
          PRD’s approved review-platform integration is available.
        </p>
      </form>
    </div>
  );
}
