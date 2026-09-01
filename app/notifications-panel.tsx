"use client";

import { useEffect, useState } from "react";

type Notification = {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export function NotificationsPanel({ organizationId }: { organizationId: string }) {
  const [items, setItems] = useState<Notification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch(`/api/v1/organizations/${organizationId}/notifications`)
      .then(async (r) => {
        if (!r.ok)
          throw new Error(
            `Unable to load notifications (request ${r.headers.get("x-request-id") ?? "unknown"})`,
          );
        return r.json();
      })
      .then((x) => setItems(x.data))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Unable to load notifications"),
      );
  }, [organizationId]);
  const markRead = async (id: string) => {
    await fetch(`/api/v1/organizations/${organizationId}/notifications/${id}/read`, {
      method: "PATCH",
    });
    setItems(
      (current) =>
        current?.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)) ?? null,
    );
  };
  if (error)
    return (
      <p
        role="alert"
        className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300"
      >
        {error}
      </p>
    );
  if (items === null) return <p className="p-4 text-sm text-neutral-400">Loading notifications…</p>;
  if (items.length === 0)
    return (
      <p className="rounded-lg border border-neutral-800 p-6 text-sm text-neutral-400">
        You’re all caught up.
      </p>
    );
  return (
    <ul className="space-y-3">
      {items.map((n) => (
        <li
          key={n.id}
          className={`rounded-lg border p-4 ${n.readAt ? "border-neutral-800 bg-neutral-900/40" : "border-emerald-700/60 bg-emerald-950/20"}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-medium">{n.title}</h3>
              <p className="mt-1 text-sm text-neutral-400">{n.body}</p>
            </div>
            {!n.readAt && (
              <button
                onClick={() => void markRead(n.id)}
                className="text-xs text-emerald-300 hover:text-emerald-200"
              >
                Mark read
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
