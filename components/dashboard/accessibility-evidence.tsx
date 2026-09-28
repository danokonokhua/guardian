import { ACCESSIBILITY_RULES, type AccessibilityConfig } from "@/lib/accessibility/types";
export function AccessibilityEvidence({ config }: { config?: AccessibilityConfig }) {
  const snapshot = config?.accessibility;
  const evidence = snapshot?.state === "UNKNOWN" ? config?.accessibilityLastKnown : snapshot;
  return (
    <section
      aria-label="Accessibility evidence"
      className="mt-3 min-w-0 rounded-lg border border-indigo-400/20 bg-neutral-950/50 p-4"
    >
      <p className="text-xs uppercase tracking-widest text-indigo-300">
        Basic accessibility · HTML checks
      </p>
      <p className="mt-2 text-sm text-neutral-300">
        One server-delivered page. CSS, JavaScript, keyboard operation and screen-reader behavior
        need separate review. This is not an accessibility certification.
      </p>
      {!snapshot ? (
        <p className="mt-3">Waiting for the first accessibility check.</p>
      ) : (
        <>
          <p className="mt-3 break-all text-sm">{snapshot.page}</p>
          <p className="mt-2 text-xs text-neutral-400">
            Last checked: {new Date(snapshot.checkedAt).toLocaleString()} · {snapshot.tool}
          </p>
          {snapshot.state === "UNKNOWN" ? (
            <p className="my-3 text-sm text-amber-300">
              Check unavailable: {snapshot.reason} Existing findings are retained.
            </p>
          ) : (
            <p className="my-3 text-sm text-indigo-200">
              {snapshot.findings.length
                ? `${snapshot.findings.reduce((n, f) => n + f.count, 0)} potential findings across ${snapshot.findings.length} rules`
                : `No findings in these HTML checks (${snapshot.elements} elements examined). Manual review is still needed.`}
            </p>
          )}
          {snapshot.state === "UNKNOWN" && evidence && (
            <p className="mb-3 text-xs text-amber-300">
              Last complete evidence (stale): {new Date(evidence.checkedAt).toLocaleString()}
            </p>
          )}
          {evidence?.findings.map((f) => (
            <details key={f.rule} className="mt-3 rounded border border-neutral-700 p-3">
              <summary className="cursor-pointer text-sm font-semibold">
                {ACCESSIBILITY_RULES[f.rule].title} · {f.count} ·{" "}
                {ACCESSIBILITY_RULES[f.rule].severity.toLowerCase()}
              </summary>
              <p className="mt-3 text-sm text-neutral-300">{ACCESSIBILITY_RULES[f.rule].fix}</p>
              <ul className="mt-2 space-y-1 text-xs text-neutral-400">
                {f.examples.map((example, index) => (
                  <li key={index}>{example}</li>
                ))}
              </ul>
              {f.count > f.examples.length && (
                <p className="mt-2 text-xs text-neutral-400">
                  Showing {f.examples.length} of {f.count} locations.
                </p>
              )}
            </details>
          ))}
        </>
      )}
    </section>
  );
}
