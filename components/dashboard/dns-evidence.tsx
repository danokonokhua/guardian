"use client";

import { useState } from "react";
import { DNS_RECORD_TYPES } from "@/lib/dns/records";

type Evidence = {
  baseline?: Record<string, string[]>;
  latest?: Record<string, { state: string; records?: string[]; reason?: string }>;
  observedAt?: string;
};

export function DnsEvidence({
  evidence,
  onAccept,
}: {
  evidence?: Evidence;
  onAccept: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const complete = DNS_RECORD_TYPES.every((type) => evidence?.latest?.[type]?.state === "OK");
  const changed = DNS_RECORD_TYPES.filter((type) => {
    const previous = evidence?.baseline?.[type];
    const latest = evidence?.latest?.[type];
    if (!previous || latest?.state !== "OK") return false;
    const current = latest.records ?? [];
    return (
      previous.some((record) => !current.includes(record)) ||
      current.some((record) => !previous.includes(record))
    );
  });
  const observed = evidence?.observedAt ? new Date(evidence.observedAt) : null;
  return (
    <details className="mt-3 min-w-0 text-sm">
      <summary className="cursor-pointer font-medium text-emerald-300">
        DNS records and baseline
      </summary>
      <p className="my-3 text-neutral-400">
        Compare records on your verified website hostname. A DNS change does not necessarily mean an
        outage.
      </p>
      <p className="mb-3" role="status">
        {!evidence?.latest
          ? "Waiting for the first DNS check."
          : !complete
            ? "Some records could not be checked. Your baseline is preserved."
            : changed.length
              ? `${changed.length} record types changed`
              : "No changes detected"}
      </p>
      {observed && !Number.isNaN(observed.getTime()) && (
        <p className="mb-3 text-xs text-neutral-400">
          Last checked: <time dateTime={observed.toISOString()}>{observed.toLocaleString()}</time>
        </p>
      )}
      <div className="grid gap-3">
        {DNS_RECORD_TYPES.map((type) => {
          const previous = evidence?.baseline?.[type];
          const latest = evidence?.latest?.[type];
          const current = latest?.records ?? [];
          return (
            <section
              key={type}
              aria-label={`${type} records`}
              className="min-w-0 rounded-lg border border-neutral-700 p-3"
            >
              <h4 className="mb-2 font-semibold">
                {type}{" "}
                <span className="text-xs font-normal text-neutral-400">
                  {latest?.state !== "OK"
                    ? "Awaiting evidence"
                    : changed.includes(type)
                      ? "Changed"
                      : previous
                        ? "Unchanged"
                        : "Initial observation"}
                </span>
              </h4>
              <div className="grid min-w-0 gap-3 lg:grid-cols-2">
                <div className="min-w-0">
                  <p className="mb-1 text-xs text-neutral-400">Accepted baseline</p>
                  {previous === undefined ? (
                    <p>No baseline yet</p>
                  ) : !previous.length ? (
                    <p>No records</p>
                  ) : (
                    previous.map((record) => (
                      <p key={record} className="break-all font-mono text-xs">
                        {latest?.state === "OK" && !current.includes(record) && (
                          <span className="text-amber-300">Removed: </span>
                        )}
                        {record}
                      </p>
                    ))
                  )}
                </div>
                <div className="min-w-0">
                  <p className="mb-1 text-xs text-neutral-400">Latest observation</p>
                  {!latest ? (
                    <p>Not checked yet</p>
                  ) : latest.state !== "OK" ? (
                    <p className="text-amber-300">
                      Check unavailable{latest.reason ? ` (${latest.reason})` : ""}
                    </p>
                  ) : !current.length ? (
                    <p>No records</p>
                  ) : (
                    current.map((record) => (
                      <p key={record} className="break-all font-mono text-xs">
                        {previous && !previous.includes(record) && (
                          <span className="text-emerald-300">Added: </span>
                        )}
                        {record}
                      </p>
                    ))
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>
      {evidence?.observedAt && (
        <div className="mt-3">
          <button
            className="button-secondary compact"
            disabled={!complete || !changed.length || pending}
            onClick={async () => {
              setPending(true);
              try {
                await onAccept();
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? "Accepting baseline…" : "Accept displayed baseline"}
          </button>
          <p className="mt-2 text-xs text-neutral-400">
            Review added and removed records before accepting. The incident clears after the next
            successful check.
          </p>
        </div>
      )}
    </details>
  );
}
