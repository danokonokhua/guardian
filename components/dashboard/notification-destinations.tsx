"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  DESTINATION_CHANNELS,
  type DestinationChannel,
} from "@/lib/notification-destinations/config";
type Destination = {
  id: string;
  name: string;
  channel: string;
  host: string;
  enabled: boolean;
  deliveries: Array<{
    id: string;
    status: string;
    attempts: number;
    httpStatus: number | null;
    lastError: string | null;
    createdAt: string;
  }>;
};
export function NotificationDestinations({ organizationId }: { organizationId: string }) {
  const base = `/api/v1/organizations/${organizationId}/notifications/destinations`;
  const [rows, setRows] = useState<Destination[] | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [channel, setChannel] = useState<DestinationChannel>("SLACK");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [signingSecret, setSigningSecret] = useState("");
  useEffect(() => {
    let cancelled = false;
    fetch(base)
      .then(async (response) => {
        if (!response.ok) throw Error("Unable to load organization destinations.");
        return response.json();
      })
      .then((body) => {
        if (!cancelled) setRows(body.data);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause.message);
      });
    return () => {
      cancelled = true;
    };
  }, [base, refresh]);
  async function mutate(path: string, method: string, body: object | undefined, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(base + path, {
        method,
        ...(body
          ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
          : {}),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error?.message ?? "Unable to update destination.");
      setMessage(success);
      setRefresh((value) => value + 1);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Destination request failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    if (
      await mutate(
        "",
        "POST",
        { name, channel, url, ...(channel === "WEBHOOK" ? { signingSecret } : {}) },
        "Destination saved paused. Send a test, then enable organization alerts.",
      )
    ) {
      setName("");
      setUrl("");
      setSigningSecret("");
    }
  }
  return (
    <section className="setup-card min-w-0" aria-label="Organization notification destinations">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2>Organization destinations</h2>
        <button
          type="button"
          className="button-secondary compact"
          disabled={busy}
          onClick={() => {
            setError("");
            setRefresh((v) => v + 1);
          }}
        >
          Refresh delivery status
        </button>
      </div>
      <p className="mt-2 text-sm text-neutral-400">
        Send incident alerts to Slack, Teams, Discord or your HTTPS webhook. Owners and admins
        manage these shared destinations. Personal email and in-app preferences remain separate.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm text-emerald-300">
          {message}
        </p>
      )}
      {rows === null ? (
        <p className="mt-3 text-sm">
          {error ? "Destinations unavailable." : "Loading destinations..."}
        </p>
      ) : !rows.length ? (
        <p className="mt-3 text-sm text-neutral-400">No external destinations configured.</p>
      ) : (
        <ul className="mt-4 grid gap-4 lg:grid-cols-2">
          {rows.map((row) => (
            <li key={row.id} className="min-w-0 rounded-lg border border-neutral-700 p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="break-all font-semibold">{row.name}</h3>
                <span className="text-xs text-indigo-300">
                  {row.enabled ? "Enabled" : "Paused"}
                </span>
              </div>
              <p className="mt-2 break-all text-xs text-neutral-400">
                {row.channel} · {row.host}
              </p>
              <div className="my-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className="button-secondary compact"
                  onClick={() =>
                    void mutate(
                      `/${row.id}`,
                      "PATCH",
                      { enabled: !row.enabled },
                      row.enabled
                        ? "Destination paused. New incident deliveries are stopped."
                        : "Destination enabled for organization incident alerts.",
                    )
                  }
                >
                  {row.enabled ? "Pause" : "Enable"} {row.name}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="button-secondary compact"
                  onClick={() =>
                    void mutate(
                      `/${row.id}/test`,
                      "POST",
                      undefined,
                      "Test queued. Refresh delivery status to see the result.",
                    )
                  }
                >
                  Send test to {row.name}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="quiet-link"
                  onClick={() => {
                    if (window.confirm(`Remove ${row.name} and its saved credentials?`))
                      void mutate(`/${row.id}`, "DELETE", undefined, "Destination removed.");
                  }}
                >
                  Remove {row.name}
                </button>
              </div>
              {!row.deliveries.length ? (
                <p className="text-xs text-neutral-500">No deliveries yet.</p>
              ) : (
                <details>
                  <summary className="cursor-pointer text-sm">
                    Delivery history — latest: {row.deliveries[0]!.status.toLowerCase()}
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {row.deliveries.map((delivery) => (
                      <li key={delivery.id} className="break-words text-xs text-neutral-400">
                        {new Date(delivery.createdAt).toLocaleString()} ·{" "}
                        {delivery.status.toLowerCase()} · {delivery.attempts} attempts
                        {delivery.httpStatus ? ` · HTTP ${delivery.httpStatus}` : ""}
                        {delivery.lastError && (
                          <p className="mt-1 text-amber-300">{delivery.lastError}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
      <form
        onSubmit={create}
        className="mt-6 grid gap-3 border-t border-neutral-800 pt-4 md:grid-cols-2"
      >
        <h3 className="font-semibold md:col-span-2">Add destination</h3>
        <label className="text-xs text-neutral-400">
          Destination name
          <input
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="guardian-input mt-2"
          />
        </label>
        <label className="text-xs text-neutral-400">
          Notification service
          <select
            aria-label="Notification service"
            value={channel}
            onChange={(e) => setChannel(e.target.value as DestinationChannel)}
            className="guardian-input mt-2"
          >
            {DESTINATION_CHANNELS.map((value) => (
              <option key={value} value={value}>
                {value === "WEBHOOK"
                  ? "Signed HTTPS webhook"
                  : value === "TEAMS"
                    ? "Microsoft Teams Workflows"
                    : value[0] + value.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-neutral-400 md:col-span-2">
          Destination webhook URL
          <input
            required
            type="password"
            autoComplete="off"
            maxLength={4096}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="guardian-input mt-2"
            placeholder="https://..."
          />
        </label>
        {channel === "WEBHOOK" && (
          <label className="text-xs text-neutral-400 md:col-span-2">
            Webhook signing secret
            <input
              required
              type="password"
              aria-label="Webhook signing secret"
              autoComplete="new-password"
              minLength={32}
              maxLength={256}
              value={signingSecret}
              onChange={(e) => setSigningSecret(e.target.value)}
              className="guardian-input mt-2"
            />
            <span className="mt-1 block">
              Use at least 32 random characters shared with your receiver. Saved secrets are never
              displayed again.
            </span>
          </label>
        )}
        {channel === "TEAMS" && (
          <p className="text-xs text-neutral-400 md:col-span-2">
            Use a Teams Workflows “When a Teams webhook request is received” URL with the anonymous
            trigger option. Legacy Office 365 connector URLs are not supported.
          </p>
        )}
        <p className="text-xs text-neutral-500 md:col-span-2">
          New destinations start paused. Test messages are sent only when you choose Send test. URLs
          and signing secrets are encrypted. To rotate credentials, remove the destination and add
          it again.
        </p>
        <button
          disabled={busy || (rows?.length ?? 0) >= 20}
          className="button-primary justify-self-start"
        >
          {busy ? "Saving..." : "Save destination"}
        </button>
      </form>
    </section>
  );
}
