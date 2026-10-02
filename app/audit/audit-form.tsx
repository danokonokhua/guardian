"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { GlassCard, StatusCapsule, GlassButton } from "@/components/ui";

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
    <div className="mt-8 w-full">
      {/* Apple-Style Tactile Scanner Input Capsule */}
      <form
        onSubmit={submit}
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 rounded-2xl sm:rounded-full bg-surface-container/60 backdrop-blur-xl border border-glass-specular-border shadow-[0_20px_50px_rgba(0,0,0,0.55)] transition-all focus-within:border-primary-container/60 focus-within:shadow-[0_0_24px_rgba(0,240,255,0.25)]"
      >
        <div className="flex-1 flex items-center gap-3 px-4 py-2 sm:py-0">
          <span className="text-primary-container text-xl select-none" aria-hidden="true">
            🌐
          </span>
          <label htmlFor="audit-url" className="sr-only">
            Website URL
          </label>
          <input
            id="audit-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://your-company.com"
            inputMode="url"
            required
            className="w-full bg-transparent font-mono text-sm sm:text-base text-on-surface placeholder:text-outline/60 focus:outline-none"
          />
        </div>
        <GlassButton
          variant="primary"
          size="md"
          type="submit"
          disabled={loading}
          className="whitespace-nowrap w-full sm:w-auto"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-on-primary-container animate-ping" />
              Scanning System…
            </span>
          ) : (
            "Scan My Business (Free) →"
          )}
        </GlassButton>
      </form>

      {error !== null && (
        <div
          role="alert"
          className="mt-6 rounded-2xl border border-status-outage/40 bg-status-outage/10 backdrop-blur-md p-4 text-sm text-status-outage shadow-[0_0_20px_rgba(244,63,94,0.15)] flex items-start gap-3"
        >
          <span className="text-lg">⚠</span>
          <p className="flex-1">{error}</p>
        </div>
      )}

      {result !== null && (
        <section aria-live="polite" className="mt-10 space-y-6 text-left">
          {/* Digital Health Index Card */}
          <GlassCard glow="emerald" variant="elevated" className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-[0.2em] font-semibold text-outline">
                  Digital Health Index
                </span>
                <span className="text-outline-variant">•</span>
                <span className="font-mono text-xs text-primary-fixed-dim">
                  {result.score.coverageWeight}% Measured
                </span>
              </div>
              <StatusCapsule
                status={
                  result.score.state.toLowerCase().includes("healthy")
                    ? "operational"
                    : result.score.state.toLowerCase().includes("warning")
                    ? "degraded"
                    : "outage"
                }
                label={result.score.state}
              />
            </div>

            <div className="mt-6 flex flex-wrap items-baseline gap-4">
              <span className="text-6xl sm:text-7xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300">
                {result.score.score === null ? "—" : result.score.score}
              </span>
              <span className="text-sm font-mono text-on-surface-variant">/ 100 max score</span>
            </div>

            <p className="mt-4 text-sm sm:text-base leading-relaxed text-on-surface-variant max-w-3xl">
              {result.score.explanation}
            </p>
          </GlassCard>

          {/* Critical Issues */}
          {result.critical.length > 0 && (
            <GlassCard glow="rose" variant="default" className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-headline font-semibold text-lg text-status-outage flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-status-outage shadow-[0_0_8px_#F43F5E] animate-pulse" />
                  Critical Revenue Blockers ({result.critical.length})
                </h3>
              </div>
              <div className="space-y-4">
                {result.critical.map((finding) => (
                  <div
                    key={finding.id}
                    className="p-4 rounded-xl bg-surface-container/60 border border-status-outage/25"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-on-surface text-sm">{finding.title}</p>
                      <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-status-outage/20 text-status-outage">
                        {finding.category}
                      </span>
                    </div>
                    <p className="mt-2 text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                      {finding.summary}
                    </p>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <GlassCard variant="default" className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-headline font-semibold text-lg text-status-degraded flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-status-degraded shadow-[0_0_8px_#F59E0B]" />
                  Performance & SEO Warnings ({result.warnings.length})
                </h3>
              </div>
              <div className="space-y-4">
                {result.warnings.map((finding) => (
                  <div
                    key={finding.id}
                    className="p-4 rounded-xl bg-surface-container/60 border border-glass-subtle-border"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-on-surface text-sm">{finding.title}</p>
                      <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">
                        {finding.category}
                      </span>
                    </div>
                    <p className="mt-2 text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                      {finding.summary}
                    </p>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Protect My Business Opportunities */}
          <GlassCard glow="cyan" variant="elevated" className="p-6 sm:p-8">
            <div className="flex items-center gap-2 text-primary-container">
              <span className="text-xl">⚡</span>
              <h3 className="font-headline text-lg sm:text-xl font-bold text-on-surface">
                Autonomous Revenue Protection
              </h3>
            </div>
            <div className="mt-4 space-y-2">
              {result.opportunities.map((opportunity) => (
                <div key={opportunity} className="flex items-start gap-2.5 text-sm text-on-surface">
                  <span className="text-primary-container mt-0.5">✓</span>
                  <span>{opportunity}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Link href="/signup">
                <GlassButton variant="primary" size="md">
                  Deploy Autonomous Safeguard →
                </GlassButton>
              </Link>
              <span className="font-mono text-xs text-outline">
                Includes continuous 24/7 uptime, lead-form, and DNS monitoring.
              </span>
            </div>
          </GlassCard>

          {/* Measured Limitations Note */}
          <div className="p-4 rounded-xl bg-surface-container-low/40 border border-glass-subtle-border text-xs leading-relaxed text-outline space-y-1">
            {result.limitations.map((limitation) => (
              <p key={limitation}>• {limitation}</p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
