"use client";
import { useEffect, useState } from "react";
import type { StatusDocument } from "@/lib/status-pages/model";
import { StatusView } from "./status-view";
export function PublicStatus({
  slug,
  initial,
  asOf,
}: {
  slug: string;
  initial: StatusDocument;
  asOf: number;
}) {
  const [document, setDocument] = useState<StatusDocument | null>(initial);
  const [now, setNow] = useState(asOf);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch(`/api/status/${slug}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 404) {
          setDocument(null);
          return;
        }
        if (!response.ok) throw Error();
        const body = await response.json();
        setDocument(body.data);
        setNow(Date.now());
        setError(false);
      } catch {
        if (!controller.signal.aborted) {
          setError(true);
          setNow(Date.now());
        }
      }
    }
    const timer = setInterval(() => void refresh(), 30000);
    const visible = () => {
      if (documentVisibility()) void refresh();
    };
    function documentVisibility() {
      return globalThis.document.visibilityState === "visible";
    }
    globalThis.document.addEventListener("visibilitychange", visible);
    return () => {
      controller.abort();
      clearInterval(timer);
      globalThis.document.removeEventListener("visibilitychange", visible);
    };
  }, [slug]);
  if (!document)
    return (
      <section className="status-panel">
        <h1>Status page unavailable</h1>
        <p>This page is no longer published.</p>
      </section>
    );
  return (
    <>
      {error && <p role="alert">Unable to refresh. Showing the last retrieved information.</p>}
      <StatusView document={document} now={now} />
    </>
  );
}
