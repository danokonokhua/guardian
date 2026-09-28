import { EMAIL_PROTOCOLS, type EmailHealthConfig } from "@/lib/email-health/types";
const colors = {
  HEALTHY: "text-emerald-300",
  MISSING: "text-amber-300",
  INVALID: "text-red-300",
  WEAK: "text-amber-300",
  UNKNOWN: "text-neutral-300",
};
export function EmailHealthEvidence({ config }: { config?: EmailHealthConfig }) {
  const snapshot = config?.emailHealth;
  return (
    <section
      aria-label="Email-domain health evidence"
      className="mt-3 min-w-0 rounded-lg border border-indigo-400/20 bg-neutral-950/50 p-4"
    >
      <p className="text-xs uppercase tracking-widest text-indigo-300">Email-domain health</p>
      <p className="mt-2 break-all font-semibold">
        {snapshot?.domain ?? "Waiting for the first email policy check"}
      </p>
      <p className="mt-2 text-xs text-neutral-400">
        {config?.domainScope === "HOSTNAME" ? "Verified website hostname" : "Registered domain"} ·
        Configuration checks only; no guarantee of delivery or inbox placement.
      </p>
      {snapshot ? (
        <>
          <p className="my-3 text-xs text-neutral-400">
            Last checked: {new Date(snapshot.checkedAt).toLocaleString()}
          </p>
          {!!config?.emailChanges?.length && (
            <p role="status" className="mb-3 text-sm text-amber-300">
              Changed since last confirmed observation:{" "}
              {config.emailChanges.map((p) => p.replace("_", "-")).join(", ")}
            </p>
          )}
          <div className="space-y-3">
            {EMAIL_PROTOCOLS.map((protocol) => {
              const check = snapshot.checks[protocol];
              const previous = config?.emailLastKnown?.[protocol];
              return (
                <article key={protocol} className="min-w-0 rounded border border-neutral-800 p-3">
                  <div className="flex flex-wrap justify-between gap-2">
                    <h4 className="text-sm font-semibold">{protocol.replace("_", "-")}</h4>
                    <span className={`text-xs font-semibold ${colors[check.state]}`}>
                      {check.state === "WEAK"
                        ? "Weak policy"
                        : check.state[0] + check.state.slice(1).toLowerCase()}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-neutral-300">{check.summary}</p>
                  {check.state === "UNKNOWN" && previous && (
                    <p className="mt-2 text-xs text-amber-300">
                      Last confirmed state (stale): {previous.state.toLowerCase()},{" "}
                      {new Date(previous.checkedAt).toLocaleString()}. Existing warnings are
                      retained.
                    </p>
                  )}
                  <details className="mt-2 text-xs text-neutral-400">
                    <summary className="cursor-pointer">
                      {protocol.replace("_", "-")} policy evidence
                    </summary>
                    <p className="my-2 break-all">Source: {check.source}</p>
                    {check.records.map((record, index) => (
                      <pre key={index} className="my-2 whitespace-pre-wrap break-all font-mono">
                        {record}
                      </pre>
                    ))}
                    {check.policy && (
                      <pre className="my-2 whitespace-pre-wrap break-all font-mono">
                        {check.policy}
                      </pre>
                    )}
                    {check.details?.map((detail, index) => (
                      <p key={index} className="mt-1 break-all">
                        {detail}
                      </p>
                    ))}
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
      <p className="mt-3 text-xs text-neutral-500">
        Guardian does not send test mail or change DNS. Review proposed policy changes with your
        email administrator.
      </p>
    </section>
  );
}
