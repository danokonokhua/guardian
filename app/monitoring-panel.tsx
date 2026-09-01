"use client";

import { useEffect, useState, type FormEvent } from "react";

type Monitor = {
  id: string;
  websiteId: string;
  type: string;
  enabled: boolean;
  frequencyMinutes: number;
  results?: Array<{
    status: string;
    checkedAt: string;
    responseTimeMs: number | null;
    httpStatusCode: number | null;
  }>;
};

type Website = {
  id: string;
  hostname: string;
  label: string | null;
  verifyStatus?: string;
  verifyToken?: string | null;
};

export function MonitoringPanel({ organizationId }: { organizationId: string }) {
  const [result, setResult] = useState<{ organizationId: string; monitors: Monitor[] } | null>(
    null,
  );
  const [error, setError] = useState<{ organizationId: string; message: string } | null>(null);
  const [websites, setWebsites] = useState<{ organizationId: string; data: Website[] } | null>(
    null,
  );
  const [reloadToken, setReloadToken] = useState(0);
  const [websiteId, setWebsiteId] = useState("");
  const [type, setType] = useState<Monitor["type"]>("UPTIME");
  const [frequencyMinutes, setFrequencyMinutes] = useState("5");
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [websiteSubmitting, setWebsiteSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/organizations/${organizationId}/monitors`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `Unable to load monitors (request ${response.headers.get("x-request-id") ?? "unknown"})`,
          );
        }
        return (await response.json()) as { data: Monitor[] };
      })
      .then((result) => {
        if (!cancelled) {
          setError(null);
          setResult({ organizationId, monitors: result.data });
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
          throw new Error(
            `Unable to load websites (request ${response.headers.get("x-request-id") ?? "unknown"})`,
          );
        }
        return (await response.json()) as { data: Website[] };
      })
      .then((result) => {
        if (!cancelled) setWebsites({ organizationId, data: result.data });
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setActionError(cause instanceof Error ? cause.message : "Unable to load websites");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, reloadToken]);

  async function createMonitor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/v1/organizations/${organizationId}/monitors`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          websiteId,
          type,
          frequencyMinutes: Number(frequencyMinutes),
          enabled: true,
          config: {},
        }),
      });
      if (!response.ok) {
        const requestId = response.headers.get("x-request-id") ?? "unknown";
        throw new Error(`Unable to create monitor (request ${requestId})`);
      }
      setWebsiteId("");
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
    try {
      const response = await fetch(`/api/v1/organizations/${organizationId}/websites`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: websiteUrl, businessName: businessName || undefined }),
      });
      if (!response.ok) {
        throw new Error(
          `Unable to add website (request ${response.headers.get("x-request-id") ?? "unknown"})`,
        );
      }
      setWebsiteUrl("");
      setBusinessName("");
      setReloadToken((value) => value + 1);
    } catch (cause: unknown) {
      setActionError(cause instanceof Error ? cause.message : "Unable to add website");
    } finally {
      setWebsiteSubmitting(false);
    }
  }

  async function verifyWebsite(website: Website) {
    setActionError(null);
    try {
      const response = await fetch(
        `/api/v1/organizations/${organizationId}/websites/${website.id}/verify`,
        { method: "POST" },
      );
      if (!response.ok) {
        throw new Error(
          `Unable to verify website (request ${response.headers.get("x-request-id") ?? "unknown"})`,
        );
      }
      setReloadToken((value) => value + 1);
    } catch (cause: unknown) {
      setActionError(cause instanceof Error ? cause.message : "Unable to verify website");
    }
  }

  async function updateMonitor(monitor: Monitor, enabled: boolean) {
    setActionError(null);
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
        throw new Error(
          `Unable to update monitor (request ${response.headers.get("x-request-id") ?? "unknown"})`,
        );
      }
      setReloadToken((value) => value + 1);
    } catch (cause: unknown) {
      setActionError(cause instanceof Error ? cause.message : "Unable to update monitor");
    }
  }

  async function runMonitor(monitor: Monitor) {
    setActionError(null);
    try {
      const response = await fetch(
        `/api/v1/organizations/${organizationId}/monitors/${monitor.id}/run`,
        { method: "POST" },
      );
      if (!response.ok) {
        throw new Error(
          `Unable to run monitor (request ${response.headers.get("x-request-id") ?? "unknown"})`,
        );
      }
    } catch (cause: unknown) {
      setActionError(cause instanceof Error ? cause.message : "Unable to run monitor");
    }
  }

  if (error?.organizationId === organizationId) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300"
      >
        {error.message}
      </p>
    );
  }
  if (result?.organizationId !== organizationId) {
    return <p className="p-4 text-sm text-neutral-400">Loading monitoring checks…</p>;
  }
  const availableWebsites = websites?.organizationId === organizationId ? websites.data : [];
  return (
    <div className="space-y-4">
      {actionError !== null && (
        <p role="alert" className="text-sm text-red-300">
          {actionError}
        </p>
      )}
      {result.monitors.length === 0 ? (
        <p className="rounded-lg border border-neutral-800 p-6 text-sm text-neutral-400">
          No monitoring checks configured yet.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {result.monitors.map((monitor) => (
            <li
              key={monitor.id}
              className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium">{monitor.type} check</h3>
                  <p className="mt-1 text-sm text-neutral-400">Website {monitor.websiteId}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs ${monitor.enabled ? "bg-emerald-950/60 text-emerald-300" : "bg-neutral-800 text-neutral-400"}`}
                >
                  {monitor.enabled ? "Enabled" : "Paused"}
                </span>
              </div>
              <p className="mt-4 text-xs text-neutral-500">
                Runs every {monitor.frequencyMinutes} minutes
              </p>
              {monitor.results?.[0] && (
                <p className="mt-2 text-xs text-neutral-400">
                  Last result: {monitor.results[0].status}
                  {monitor.results[0].responseTimeMs !== null
                    ? ` · ${monitor.results[0].responseTimeMs} ms`
                    : ""}
                </p>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="rounded-md border border-neutral-700 px-3 py-1 text-xs hover:bg-neutral-800"
                  onClick={() => void updateMonitor(monitor, !monitor.enabled)}
                >
                  {monitor.enabled ? "Pause" : "Enable"}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-neutral-700 px-3 py-1 text-xs hover:bg-neutral-800"
                  onClick={() => void runMonitor(monitor)}
                >
                  Run now
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {availableWebsites.length === 0 && (
        <form
          onSubmit={(event) => void onboardWebsite(event)}
          className="rounded-lg border border-neutral-800 p-4"
        >
          <h3 className="font-medium">Add your first website</h3>
          <p className="mt-1 text-sm text-neutral-400">
            Guardian will use this website for your monitoring checks.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-[2fr_1fr_auto]">
            <label className="text-xs text-neutral-400">
              Website URL
              <input
                required
                type="url"
                value={websiteUrl}
                onChange={(event) => setWebsiteUrl(event.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                placeholder="https://example.com"
              />
            </label>
            <label className="text-xs text-neutral-400">
              Business name (optional)
              <input
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                placeholder="My business"
              />
            </label>
            <button
              type="submit"
              disabled={websiteSubmitting}
              className="self-end rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
            >
              {websiteSubmitting ? "Adding…" : "Add website"}
            </button>
          </div>
        </form>
      )}
      {availableWebsites.length > 0 &&
        availableWebsites.some((website) => website.verifyStatus !== "VERIFIED") && (
          <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-4 text-sm text-amber-200">
            {availableWebsites
              .filter((website) => website.verifyStatus !== "VERIFIED")
              .map((website) => (
                <div key={website.id} className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    Verify <strong>{website.label || website.hostname}</strong> by serving token{" "}
                    <code className="rounded bg-neutral-950 px-1.5 py-0.5 text-xs">
                      {website.verifyToken}
                    </code>{" "}
                    at <code>/.well-known/guardian-verification.txt</code>.
                  </span>
                  <button
                    type="button"
                    onClick={() => void verifyWebsite(website)}
                    className="rounded-md border border-amber-700 px-3 py-1 text-xs hover:bg-amber-900/40"
                  >
                    Verify now
                  </button>
                </div>
              ))}
          </div>
        )}
      <form
        onSubmit={(event) => void createMonitor(event)}
        className="rounded-lg border border-neutral-800 p-4"
      >
        <h3 className="font-medium">Add a monitoring check</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
          <label className="text-xs text-neutral-400">
            Website
            <select
              required
              value={websiteId}
              onChange={(event) => setWebsiteId(event.target.value)}
              disabled={availableWebsites.length === 0}
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 disabled:opacity-50"
            >
              <option value="">Select a website</option>
              {availableWebsites.map((website) => (
                <option key={website.id} value={website.id}>
                  {website.label || website.hostname}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-neutral-400">
            Check type
            <select
              value={type}
              onChange={(event) => setType(event.target.value as Monitor["type"])}
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
            >
              {["UPTIME", "SSL", "SEO", "CONTENT", "LINKS", "PERFORMANCE", "FORM"].map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-neutral-400">
            Frequency (min)
            <input
              required
              min={1}
              max={1440}
              type="number"
              value={frequencyMinutes}
              onChange={(event) => setFrequencyMinutes(event.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
            />
          </label>
          <button
            type="submit"
            disabled={submitting || availableWebsites.length === 0}
            className="self-end rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-neutral-950 disabled:opacity-50"
          >
            {submitting ? "Adding…" : "Add check"}
          </button>
        </div>
      </form>
    </div>
  );
}
