"use client";

import { useState } from "react";
import {
  EMAIL_PROTOCOLS,
  calculateDeliverabilityScore,
  type EmailHealthConfig,
  type EmailProtocol,
  type PolicyEvidence,
} from "@/lib/email-health/types";

const badgeStyles = {
  HEALTHY: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  MISSING: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  INVALID: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  WEAK: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  UNKNOWN: "bg-neutral-800 text-neutral-400 border-neutral-700",
};

function CopyRecordButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 transition"
      title="Copy record to clipboard"
    >
      <span>{copied ? "✓ Copied!" : "📋 Copy"}</span>
    </button>
  );
}

function getRemediationTips(checks: Record<EmailProtocol, PolicyEvidence>): string[] {
  const tips: string[] = [];

  if (checks.SPF?.state === "MISSING") {
    tips.push("SPF: Publish an SPF TXT record (e.g. v=spf1 include:_spf.example.com -all) to specify authorized mail senders.");
  } else if (checks.SPF?.state === "WEAK") {
    tips.push("SPF: Upgrade softfail (~all) or neutral (?all) to strict hardfail (-all) to prevent unauthorized relaying.");
  }

  if (checks.DMARC?.state === "MISSING") {
    tips.push("DMARC: Publish a _dmarc TXT record with at least p=none to monitor spoofing and protect domain reputation.");
  } else if (checks.DMARC?.state === "WEAK") {
    tips.push("DMARC: Upgrade policy from p=none to p=quarantine or p=reject to actively block fraudulent emails.");
  }

  if (checks.DKIM?.state === "MISSING") {
    tips.push("DKIM: Publish a cryptographic DKIM signature key for your mail provider on a valid selector (e.g. google._domainkey).");
  } else if (checks.DKIM?.state === "WEAK") {
    tips.push("DKIM: Replace the revoked or empty DKIM public key on your selector.");
  }

  if (checks.MTA_STS?.state === "MISSING") {
    tips.push("MTA-STS: Enable SMTP TLS policy enforcement (_mta-sts TXT) to prevent man-in-the-middle downgrade attacks.");
  }

  return tips;
}

export function EmailHealthEvidence({ config }: { config?: EmailHealthConfig }) {
  const snapshot = config?.emailHealth;
  const deliverability = calculateDeliverabilityScore(snapshot?.checks);
  const remediationTips = snapshot?.checks ? getRemediationTips(snapshot.checks) : [];

  return (
    <section
      aria-label="Email-domain health evidence"
      className="mt-3 min-w-0 rounded-lg border border-indigo-400/20 bg-neutral-950/50 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-widest text-indigo-300 font-bold">Email-domain health</p>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
          {config?.domainScope === "HOSTNAME" ? "Verified Hostname" : "Registered Domain"}
        </span>
      </div>

      <p className="mt-2 break-all font-bold text-white text-base">
        {snapshot?.domain ?? "Waiting for the first email policy check"}
      </p>

      {snapshot ? (
        <>
          {/* Deliverability Score Gauge Card */}
          <div className="my-3 rounded-lg border border-neutral-800 bg-neutral-900/70 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-neutral-300">Deliverability & Spoofing Defense</p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Composite score across SPF, DMARC, DKIM, and MTA-STS
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`text-2xl font-black ${
                    deliverability.score >= 80
                      ? "text-emerald-400"
                      : deliverability.score >= 50
                        ? "text-amber-400"
                        : "text-rose-400"
                  }`}
                >
                  {deliverability.score}
                </span>
                <span className="text-xs text-neutral-400 font-bold">/100</span>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  deliverability.score >= 80
                    ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.5)]"
                    : deliverability.score >= 50
                      ? "bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.5)]"
                      : "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.5)]"
                }`}
                style={{ width: `${Math.max(4, deliverability.score)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] pt-0.5">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                  deliverability.status === "EXCELLENT"
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                    : deliverability.status === "GOOD"
                      ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                      : deliverability.status === "WARNING"
                        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                        : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                }`}
              >
                {deliverability.label}
              </span>
              <span className="text-neutral-500">
                Last checked: {new Date(snapshot.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Actionable Remediation Guidance */}
          {remediationTips.length > 0 ? (
            <div className="mb-3 p-3 rounded-lg bg-amber-950/30 border border-amber-500/30 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                <span>💡</span>
                <span>Recommendations to reach 100/100:</span>
              </div>
              <ul className="space-y-1 text-xs text-neutral-300 pl-4 list-disc">
                {remediationTips.map((tip, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mb-3 p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300">
              <span>🛡️</span>
              <span>All 4 email defense standards are fully verified. Domain is protected against spoofing.</span>
            </div>
          )}

          {!!config?.emailChanges?.length && (
            <p role="status" className="mb-3 text-sm text-amber-300">
              Changed since last confirmed observation:{" "}
              {config.emailChanges.map((p) => p.replace("_", "-")).join(", ")}
            </p>
          )}

          {/* Protocol Cards */}
          <div className="space-y-3">
            {EMAIL_PROTOCOLS.map((protocol) => {
              const check = snapshot.checks[protocol];
              const previous = config?.emailLastKnown?.[protocol];
              return (
                <article key={protocol} className="min-w-0 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-white">{protocol.replace("_", "-")}</h4>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${badgeStyles[check.state]}`}>
                      {check.state === "WEAK"
                        ? "Weak policy"
                        : check.state[0] + check.state.slice(1).toLowerCase()}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-neutral-300 leading-relaxed">{check.summary}</p>
                  {check.state === "UNKNOWN" && previous && (
                    <p className="mt-2 text-xs text-amber-300">
                      Last confirmed state (stale): {previous.state.toLowerCase()},{" "}
                      {new Date(previous.checkedAt).toLocaleString()}. Existing warnings are
                      retained.
                    </p>
                  )}
                  <details className="mt-2.5 text-xs text-neutral-400">
                    <summary className="cursor-pointer hover:text-white transition select-none">
                      {protocol.replace("_", "-")} policy evidence & records
                    </summary>
                    <div className="mt-2 space-y-2 pt-2 border-t border-neutral-800/80">
                      <p className="break-all font-mono text-[11px] text-neutral-400">
                        <span className="text-neutral-500">Source:</span> {check.source}
                      </p>
                      {check.records.map((record, index) => (
                        <div key={index} className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-neutral-500 font-mono">Published Record #{index + 1}</span>
                            <CopyRecordButton text={record} />
                          </div>
                          <pre className="p-2 rounded bg-neutral-900 border border-neutral-800 whitespace-pre-wrap break-all font-mono text-neutral-200 text-xs">
                            {record}
                          </pre>
                        </div>
                      ))}
                      {check.policy && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-neutral-500 font-mono">Parsed Policy Directive</span>
                            <CopyRecordButton text={check.policy} />
                          </div>
                          <pre className="p-2 rounded bg-neutral-900 border border-neutral-800 whitespace-pre-wrap break-all font-mono text-neutral-200 text-xs">
                            {check.policy}
                          </pre>
                        </div>
                      )}
                      {check.details?.map((detail, index) => (
                        <p key={index} className="break-all text-neutral-400 text-xs">
                          {detail}
                        </p>
                      ))}
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-neutral-400">
          Not checked yet. Enable the monitor for a verified website to collect policies.
        </p>
      )}
      <p className="mt-3 text-[11px] text-neutral-500 leading-normal">
        Guardian inspects public DNS records and HTTPS endpoints without sending test email or mutating zone records.
      </p>
    </section>
  );
}
