"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";

interface MobileDevice {
  id: string;
  endpoint: string;
  userAgent: string | null;
  createdAt: string;
}

interface MobileHubData {
  deviceCount: number;
  devices: MobileDevice[];
  vapidPublicKey: string;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function MobileHubView({ organizationId }: { organizationId: string }) {
  const [data, setData] = useState<MobileHubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Browser push state
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isTestingPush, setIsTestingPush] = useState(false);

  const fetchMobileOverview = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/v1/organizations/${organizationId}/mobile`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error?.message || "Failed to load mobile hub");
      }
      const json = await res.json();
      setData(json.data);
    } catch (err: any) {
      setError(err.message || "Failed to load mobile hub");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const supported = "serviceWorker" in navigator && "PushManager" in window;
      setIsSupported(supported);
      if ("Notification" in window) {
        setPermission(Notification.permission);
      }
    }
    if (organizationId) {
      void fetchMobileOverview();
    }
  }, [organizationId]);

  const handleSubscribe = async () => {
    if (!isSupported) {
      alert("Web Push is not supported by your current browser.");
      return;
    }

    try {
      setIsSubscribing(true);
      setFeedback(null);

      const requestedPermission = await Notification.requestPermission();
      setPermission(requestedPermission);

      if (requestedPermission !== "granted") {
        setFeedback(
          "Notification permission was denied. Please allow notifications in browser settings.",
        );
        return;
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Get VAPID public key
      const keyRes = await fetch(`/api/v1/organizations/${organizationId}/mobile/push/public-key`);
      const keyData = await keyRes.json();
      const vapidKey = keyData.data?.vapidPublicKey || data?.vapidPublicKey;

      if (!vapidKey) {
        throw new Error("Unable to retrieve VAPID public key");
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as ArrayBuffer,
      });

      const rawSub = subscription.toJSON();
      if (!rawSub.endpoint || !rawSub.keys?.p256dh || !rawSub.keys?.auth) {
        throw new Error("Invalid push subscription structure returned by browser");
      }

      // Save to server
      const saveRes = await fetch(`/api/v1/organizations/${organizationId}/mobile/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: rawSub.endpoint,
          keys: {
            p256dh: rawSub.keys.p256dh,
            auth: rawSub.keys.auth,
          },
          userAgent: navigator.userAgent,
        }),
      });

      if (!saveRes.ok) {
        throw new Error("Failed to register push subscription on server");
      }

      setFeedback("Device successfully registered for instant Guardian push alerts! ✓");
      void fetchMobileOverview();
    } catch (err: any) {
      setFeedback(`Push subscription error: ${err.message}`);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleTestPush = async () => {
    try {
      setIsTestingPush(true);
      setFeedback(null);

      const res = await fetch(`/api/v1/organizations/${organizationId}/mobile/push/test`, {
        method: "POST",
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error?.message || "Test push failed");
      }

      const json = await res.json();
      setFeedback(
        `Test push sent! Check your notification tray. (${json.data.dispatchedCount} device(s) pinged) ✓`,
      );
    } catch (err: any) {
      setFeedback(`Test push error: ${err.message}`);
    } finally {
      setIsTestingPush(false);
    }
  };

  const handleUnsubscribeDevice = async (endpoint: string) => {
    if (!confirm("Are you sure you want to unregister this mobile device?")) return;

    try {
      const res = await fetch(`/api/v1/organizations/${organizationId}/mobile/push/unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });

      if (res.ok) {
        void fetchMobileOverview();
      }
    } catch (err: any) {
      alert("Error removing device");
    }
  };

  return (
    <div className="space-y-8 pb-16 md:pb-0">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-on-surface">
              Mobile Command & Web Push
            </h1>
            <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-400 border border-cyan-500/30">
              PRD §21 / PWA
            </span>
          </div>
          <p className="mt-1 text-sm text-on-surface-variant">
            Instant RFC 8291 Web Push incident alerts, home-screen installation, and mobile
            telemetry command center.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleTestPush}
            disabled={isTestingPush || (data?.deviceCount ?? 0) === 0}
            className="flex items-center gap-2 rounded-xl bg-surface-container-high/60 px-4 py-2 text-xs font-medium text-cyan-300 border border-cyan-500/30 hover:bg-surface-container-high transition disabled:opacity-50"
          >
            <span>🔔</span>
            <span>{isTestingPush ? "Dispatching..." : "Send Test Push"}</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-200">
          <span>🛡️</span>
          <span>{feedback}</span>
        </div>
      )}

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GlassCard className="p-5" glow="cyan">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>Registered Devices</span>
            <span className="font-mono text-cyan-400">ACTIVE</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-on-surface">
              {data?.deviceCount ?? 0}
            </span>
            <span className="text-xs text-on-surface-variant">devices</span>
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">Operator mobile endpoints</p>
        </GlassCard>

        <GlassCard className="p-5" glow="emerald">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>Browser Push</span>
            <span className="font-mono text-emerald-400">STATUS</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-emerald-400 uppercase">
              {permission}
            </span>
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">
            {isSupported ? "Supported on this browser" : "Not supported by browser"}
          </p>
        </GlassCard>

        <GlassCard className="p-5" glow="violet">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>VAPID Security</span>
            <span className="font-mono text-purple-400">RFC 8292</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-on-surface">ECDSA P-256</span>
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">Cryptographic request signing</p>
        </GlassCard>

        <GlassCard className="p-5" glow="none">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>PWA Status</span>
            <span className="font-mono text-on-surface-variant">STANDALONE</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-cyan-400">Ready</span>
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">Home screen installable</p>
        </GlassCard>
      </div>

      {/* Push Setup Card */}
      <GlassCard className="p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-on-surface">
              Enable Push Alerts On This Device
            </h2>
            <p className="text-xs text-on-surface-variant max-w-xl">
              Receive real-time push notifications when critical uptime, SSL, lead form, or security
              issues occur, even when your browser is in the background or device is locked.
            </p>
          </div>

          <button
            onClick={handleSubscribe}
            disabled={isSubscribing || !isSupported}
            className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 transition disabled:opacity-50 whitespace-nowrap"
          >
            {isSubscribing ? "Registering..." : "Enable Push Alerts"}
          </button>
        </div>
      </GlassCard>

      {/* PWA Home Screen Installation Guide */}
      <GlassCard className="p-6">
        <h2 className="text-base font-semibold text-on-surface mb-3">
          Install as Mobile App (PWA)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="rounded-xl bg-surface-container-lowest/60 p-4 border border-outline-variant/40 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-cyan-300">
              <span>🍏</span>
              <span>iOS (iPhone & iPad)</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-on-surface-variant pl-1">
              <li>Open Guardian in Safari.</li>
              <li>
                Tap the <strong className="text-on-surface">Share</strong> icon (square with arrow).
              </li>
              <li>
                Scroll down and select{" "}
                <strong className="text-on-surface">Add to Home Screen</strong>.
              </li>
              <li>Launch directly from your home screen as a standalone app.</li>
            </ol>
          </div>

          <div className="rounded-xl bg-surface-container-lowest/60 p-4 border border-outline-variant/40 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-cyan-300">
              <span>🤖</span>
              <span>Android (Chrome & Brave)</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-on-surface-variant pl-1">
              <li>Open Guardian in Chrome or browser of choice.</li>
              <li>
                Tap the <strong className="text-on-surface">Menu (⋮)</strong> icon.
              </li>
              <li>
                Select <strong className="text-on-surface">Install app</strong> or{" "}
                <strong className="text-on-surface">Add to Home screen</strong>.
              </li>
              <li>Launch from your app drawer with standalone immersive mode.</li>
            </ol>
          </div>
        </div>
      </GlassCard>

      {/* Registered Devices Table */}
      <GlassCard className="p-6">
        <h2 className="text-base font-semibold text-on-surface mb-2">Registered Mobile Devices</h2>
        <p className="text-xs text-on-surface-variant mb-4">
          All endpoints currently receiving real-time alerts for this organization.
        </p>

        {loading ? (
          <div className="py-8 text-center text-xs text-on-surface-variant animate-pulse">
            Loading devices...
          </div>
        ) : error ? (
          <div className="py-6 text-center text-xs text-rose-400">{error}</div>
        ) : !data || data.devices.length === 0 ? (
          <div className="py-8 text-center text-xs text-on-surface-variant">
            No mobile devices registered yet. Click &quot;Enable Push Alerts&quot; above to connect
            this device.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-outline-variant/40 text-on-surface-variant">
                  <th className="py-2.5 px-3 font-semibold">Device / User Agent</th>
                  <th className="py-2.5 px-3 font-semibold">Registered</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {data.devices.map((device) => (
                  <tr key={device.id} className="hover:bg-surface-container-high/30 transition">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-cyan-300 max-w-xs truncate">
                      {device.userAgent || "Unknown Device"}
                    </td>
                    <td className="py-2.5 px-3 text-on-surface-variant">
                      {new Date(device.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleUnsubscribeDevice(device.endpoint)}
                        className="rounded-lg bg-rose-500/10 px-2 py-1 text-[11px] font-medium text-rose-300 hover:bg-rose-500/20 transition"
                      >
                        Unregister
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
