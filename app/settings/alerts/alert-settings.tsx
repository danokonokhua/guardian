"use client";
import { useEffect, useState, type FormEvent } from "react";
import { NotificationsPanel } from "@/app/notifications-panel";
import { NotificationDestinations } from "@/components/dashboard/notification-destinations";
type Policy = { acknowledgeMinutes: number; resolveMinutes: number };
type Preferences = { IN_APP: boolean; EMAIL: boolean };
export function AlertSettings({
  organizationId,
  canManage,
  canManageDestinations = false,
}: {
  organizationId: string;
  canManage: boolean;
  canManageDestinations?: boolean;
}) {
  const base = `/api/v1/organizations/${organizationId}`;
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetch(`${base}/sla`), fetch(`${base}/notifications/preferences`)])
      .then(async (responses) => {
        if (responses.some((r) => !r.ok))
          throw Error("Unable to load alert settings. Please retry.");
        return Promise.all(responses.map((r) => r.json()));
      })
      .then(([sla, prefs]) => {
        if (!cancelled) {
          setPolicy(sla.data);
          setPreferences(prefs.data);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [base, retry]);
  async function savePolicy(event: FormEvent) {
    event.preventDefault();
    if (!policy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const r = await fetch(`${base}/sla`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(policy),
      });
      if (!r.ok) throw Error("Unable to save SLA policy.");
      const body = await r.json();
      setPolicy(body.data);
      setMessage("Organization SLA policy saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save policy.");
    } finally {
      setBusy(false);
    }
  }
  async function toggle(channel: keyof Preferences) {
    if (!preferences) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const enabled = !preferences[channel];
      const r = await fetch(`${base}/notifications/preferences`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel, enabled }),
      });
      if (!r.ok) throw Error("Unable to save notification preference.");
      setPreferences({ ...preferences, [channel]: enabled });
      setMessage("Your notification preference was saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save preference.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {error && (
        <div role="alert" className="setup-card">
          <p>{error}</p>
          <button
            className="quiet-link"
            disabled={busy}
            onClick={() => {
              setError(null);
              setRetry((n) => n + 1);
            }}
          >
            Reload settings
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="text-emerald-300">
          {message}
        </p>
      )}
      {!policy || !preferences ? (
        <p role="status">{error ? "Settings unavailable." : "Loading alert settings..."}</p>
      ) : (
        <div className="onboarding-grid">
          <section className="setup-card">
            <span className="eyebrow">PERSONAL PREFERENCES</span>
            <h2>Issue notification channels</h2>
            <p>
              These preferences apply to your issue escalation notifications in this organization.
              Recipient eligibility still follows your role and the escalation policy.
            </p>
            {(["IN_APP", "EMAIL"] as const).map((channel) => (
              <div className="alert-channel" key={channel}>
                <div>
                  <h3>{channel === "IN_APP" ? "In-app notifications" : "Email notifications"}</h3>
                  <p>
                    {channel === "IN_APP"
                      ? "Read issue alerts in Guardian."
                      : "Email delivery requires configured SMTP on the server."}
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={preferences[channel]}
                  aria-label={channel === "IN_APP" ? "In-app notifications" : "Email notifications"}
                  disabled={busy}
                  onClick={() => void toggle(channel)}
                  className="button-secondary compact"
                >
                  {preferences[channel] ? "Enabled" : "Disabled"}
                </button>
              </div>
            ))}
            <p className="fine-print">
              Changing a preference does not recall notifications already queued. WhatsApp, Slack,
              and voice routing are not configured here.
            </p>
          </section>
          <section className="setup-card">
            <span className="eyebrow">ORGANIZATION POLICY</span>
            <h2>Response targets</h2>
            <p>
              Set the time allowed to acknowledge and resolve an incident. Targets are expressed in
              minutes.
            </p>
            <form onSubmit={savePolicy} className="mt-5 space-y-4">
              <label className="block text-sm">
                Acknowledge within (minutes)
                <input
                  type="number"
                  min={1}
                  max={10080}
                  step={1}
                  required
                  disabled={!canManage || busy}
                  className="guardian-input mt-2"
                  value={policy.acknowledgeMinutes}
                  onChange={(e) =>
                    setPolicy({ ...policy, acknowledgeMinutes: e.target.valueAsNumber })
                  }
                />
              </label>
              <label className="block text-sm">
                Resolve within (minutes)
                <input
                  type="number"
                  min={1}
                  max={43200}
                  step={1}
                  required
                  disabled={!canManage || busy}
                  className="guardian-input mt-2"
                  value={policy.resolveMinutes}
                  onChange={(e) => setPolicy({ ...policy, resolveMinutes: e.target.valueAsNumber })}
                />
              </label>
              {canManage ? (
                <button className="button-primary" disabled={busy}>
                  {busy ? "Saving..." : "Save SLA policy"}
                </button>
              ) : (
                <p>Your role can view this policy but cannot change it.</p>
              )}
            </form>
          </section>
        </div>
      )}
      {canManageDestinations && <NotificationDestinations organizationId={organizationId} />}
      <section className="setup-card">
        <h2>Recent notifications</h2>
        <NotificationsPanel organizationId={organizationId} />
      </section>
    </>
  );
}
