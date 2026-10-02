"use client";
import { useState } from "react";
import { DEFAULT_EXPIRY_THRESHOLDS, expiryConfigSchema } from "@/lib/domain-expiry/config";
export type ExpiryEvidence = {
  state: string;
  domain: string;
  expiresAt?: string;
  source?: string;
  reason?: string;
  checkedAt: string;
  thresholdDays?: number | null;
};
function date(value: string) {
  return new Date(value).toLocaleString();
}
export function DomainExpiryEvidence({
  evidence,
  lastSuccessful,
  thresholds,
  onSave,
}: {
  evidence?: ExpiryEvidence;
  lastSuccessful?: ExpiryEvidence;
  thresholds?: number[];
  onSave: (thresholds: number[]) => Promise<void>;
}) {
  const [draft, setDraft] = useState((thresholds ?? DEFAULT_EXPIRY_THRESHOLDS).join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const days =
    evidence?.state === "KNOWN" && evidence.expiresAt
      ? Math.ceil((Date.parse(evidence.expiresAt) - Date.parse(evidence.checkedAt)) / 86400000)
      : null;
  return (
    <section
      className="mt-3 min-w-0 rounded-lg border border-indigo-400/20 bg-neutral-950/50 p-4"
      aria-label="Domain registration expiry"
    >
      <p className="text-xs uppercase tracking-widest text-indigo-300">Domain registration</p>
      <p className="mt-2 break-all font-semibold">
        {evidence?.domain ?? "Waiting for the first registration check"}
      </p>
      <p
        role="status"
        className={`mt-2 text-lg font-semibold ${evidence?.state === "UNKNOWN" || (days !== null && days <= 30) ? "text-amber-300" : "text-emerald-300"}`}
      >
        {!evidence
          ? "Not checked yet"
          : days === null
            ? "Expiry unknown"
            : days <= 0
              ? "Registration expired"
              : `${days} days until registry expiry`}
      </p>
      {evidence?.state === "UNKNOWN" && (
        <p className="mt-2 text-sm text-neutral-400">
          The registry did not provide usable expiry evidence ({evidence.reason}). This does not
          mean the domain is healthy or available.
        </p>
      )}
      {evidence?.state === "KNOWN" && evidence.expiresAt && (
        <p className="mt-2 text-sm">
          Expires: <time dateTime={evidence.expiresAt}>{date(evidence.expiresAt)}</time>
        </p>
      )}
      {evidence?.state === "UNKNOWN" && lastSuccessful?.expiresAt && (
        <p className="mt-2 text-sm text-amber-300">
          Last confirmed expiry (stale): {date(lastSuccessful.expiresAt)}. Last successful refresh:{" "}
          {date(lastSuccessful.checkedAt)}.
        </p>
      )}
      {evidence && (
        <p className="mt-2 text-xs text-neutral-400">Last checked: {date(evidence.checkedAt)}</p>
      )}
      {evidence?.source?.startsWith("https://") && (
        <a
          className="mt-2 block break-all text-xs text-indigo-300 underline"
          href={evidence.source}
          target="_blank"
          rel="noreferrer"
        >
          View registry evidence
        </a>
      )}
      <p className="my-3 text-xs text-neutral-400">
        Registration expiry is separate from SSL expiry. Registry dates may differ from your
        registrar&apos;s billing deadline. Alerts go once per domain, expiry date and threshold to
        eligible owners/admins using their notification preferences.
      </p>
      <label className="block text-xs text-neutral-400">
        Advance alerts (days, comma separated)
        <input
          className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </label>
      <button
        className="button-secondary compact mt-3"
        disabled={busy}
        onClick={async () => {
          setError(null);
          setSaved(false);
          const parsed = expiryConfigSchema.safeParse({
            thresholds: draft.split(",").map((value) => Number(value.trim())),
          });
          if (!parsed.success) {
            setError("Enter 1–6 unique whole-day thresholds between 1 and 365.");
            return;
          }
          setBusy(true);
          try {
            await onSave(parsed.data.thresholds!);
            setSaved(true);
          } catch {
            setError("Could not save alert thresholds. Try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Saving…" : "Save expiry alerts"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-300">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="mt-2 text-sm text-emerald-300">
          Expiry alert thresholds saved.
        </p>
      )}
    </section>
  );
}
