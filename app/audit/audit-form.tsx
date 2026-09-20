"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type Finding = {
  id: string;
  category: string;
  severity: string;
  title: string;
  summary: string;
};

type AuditResponse = {
  url: string;
  score: { score: number | null; state: string; coverageWeight: number; explanation: string };
  critical: Finding[];
  warnings: Finding[];
  opportunities: string[];
  limitations: string[];
};

export default function AuditForm() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<AuditResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const body = (await response.json()) as {
        data?: AuditResponse;
        error?: { message?: string };
      };
      if (!response.ok || body.data === undefined) {
        throw new Error(body.error?.message ?? "The audit could not be completed.");
      }
      setResult(body.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The audit could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8">
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="audit-url" className="sr-only">
          Website URL
        </label>
        <input
          id="audit-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://your-business.com"
          inputMode="url"
          required
          className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-neutral-100 outline-none ring-emerald-500 placeholder:text-neutral-600 focus:ring-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-emerald-600 px-5 py-3 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? "Auditing…" : "Run free audit"}
        </button>
      </form>

      {error !== null && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-300"
        >
          {error}
        </p>
      )}

      {result !== null && (
        <section aria-live="polite" className="mt-8 space-y-6">
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
              Digital health score
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-3">
              <span className="text-5xl font-bold text-emerald-400">
                {result.score.score === null ? "—" : result.score.score}
              </span>
              <span className="text-sm text-neutral-400">
                {result.score.state.toLowerCase()} · {result.score.coverageWeight}% measured
              </span>
            </div>
            <p className="mt-3 text-sm text-neutral-400">{result.score.explanation}</p>
          </div>

          <FindingGroup
            title="Critical issues"
            findings={result.critical}
            empty="No critical issues found."
          />
          <FindingGroup title="Warnings" findings={result.warnings} empty="No warnings found." />

          <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-5">
            <h2 className="text-lg font-semibold">Protect my business</h2>
            {result.opportunities.map((opportunity) => (
              <p key={opportunity} className="mt-2 text-sm text-neutral-300">
                {opportunity}
              </p>
            ))}
            <Link
              href="/signup"
              className="mt-4 inline-flex rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Create an account
            </Link>
          </div>

          <div className="text-xs leading-relaxed text-neutral-500">
            {result.limitations.map((limitation) => (
              <p key={limitation}>{limitation}</p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function FindingGroup({
  title,
  findings,
  empty,
}: {
  title: string;
  findings: Finding[];
  empty: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {findings.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">{empty}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {findings.map((finding) => (
            <article key={finding.id} className="border-l-2 border-amber-500/70 pl-3">
              <p className="text-sm font-medium text-neutral-100">
                {finding.title}{" "}
                <span className="text-xs text-neutral-500">({finding.category})</span>
              </p>
              <p className="mt-1 text-sm text-neutral-400">{finding.summary}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
