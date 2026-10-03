"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { HealthData } from "@/app/health-panel";
export const viewConfig = {
  health: {
    title: "Digital Health Vitals",
    description: "Website availability, SSL, links, and server response measurements.",
    types: ["UPTIME", "SSL", "LINKS", "PERFORMANCE"],
    categories: ["WEBSITE", "PERFORMANCE"],
    rules: [
      "monitor.uptime",
      "monitor.http_status",
      "monitor.ssl",
      "monitor.links",
      "monitor.performance",
    ],
    limit:
      "Server response measurements are not browser Core Web Vitals. Results reflect configured checks, not global uptime coverage.",
  },
  seo: {
    title: "SEO Insights",
    description: "Understand the essential search signals on your verified homepage.",
    types: ["SEO"],
    categories: ["SEO"],
    rules: ["monitor.seo"],
    limit:
      "Checks cover basic page metadata, indexability, robots, and sitemap signals. Keyword rankings and competitor tracking are not measured.",
  },
  security: {
    title: "Security Posture",
    description: "Review operational security hygiene and the evidence behind each finding.",
    types: ["SECURITY", "SSL"],
    categories: ["SECURITY"],
    rules: ["monitor.security", "monitor.ssl"],
    limit:
      "Guardian provides operational security health checks, not a full cybersecurity assessment. Plugin CVE scanning and automatic patching are not included.",
  },
  revenue: {
    title: "Lead-form Health",
    description: "Check the availability of the forms customers use to contact your business.",
    types: ["FORM"],
    categories: ["LEAD_GENERATION"],
    rules: ["monitor.form"],
    limit:
      "These checks inspect server-rendered forms and optional safe probes. They do not submit leads, confirm downstream delivery, or calculate lost revenue.",
  },
  reputation: {
    title: "Reputation & Review Intelligence",
    description: "Monitor customer ratings, unanswered review volume, and local search presence.",
    types: ["REPUTATION", "BUSINESS_PROFILE", "GOOGLE_GBP"],
    categories: ["REPUTATION"],
    rules: ["RULE_GBP_LOW_RATING", "RULE_GBP_UNANSWERED_REVIEWS", "monitor.reputation"],
    limit:
      "Reputation signals are synchronized from verified Google Business Profiles. Automatic reply publishing is not performed without operator review.",
  },
};
export type MonitoringView = keyof typeof viewConfig;
export function MonitoringViewPanel({
  organizationId,
  view,
}: {
  organizationId: string;
  view: MonitoringView;
}) {
  const [data, setData] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const config = viewConfig[view];
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/organizations/${organizationId}/health`)
      .then(async (r) => {
        if (!r.ok) throw Error("Unable to load monitoring results. Please retry.");
        return r.json();
      })
      .then((body) => {
        if (!cancelled) setData(body.data);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, retry]);
  const nav = (
    <nav className="view-tabs" aria-label="Monitoring categories">
      {Object.entries(viewConfig).map(([key, value]) => (
        <Link href={`/${key}`} key={key} aria-current={key === view ? "page" : undefined}>
          {value.title}
        </Link>
      ))}
    </nav>
  );
  if (error)
    return (
      <>
        {nav}
        <div role="alert" className="setup-card">
          <p>{error}</p>
          <button
            className="button-primary mt-4"
            onClick={() => {
              setError(null);
              setData(null);
              setRetry((n) => n + 1);
            }}
          >
            Retry
          </button>
        </div>
      </>
    );
  if (!data)
    return (
      <>
        {nav}
        <p role="status">Loading monitoring evidence...</p>
      </>
    );
  const results = data.recentResults.filter((r) => config.types.includes(r.monitorType));
  const components =
    data.healthScore?.components.filter((c) => config.categories.includes(c.category)) ?? [];
  const issues = data.issues.filter(
    (i) => config.rules.includes(i.ruleId ?? "") && !["RESOLVED", "IGNORED"].includes(i.status),
  );
  const recommendations = (data.recommendations ?? []).filter((r) =>
    config.rules.includes(r.source.ruleId),
  );
  return (
    <>
      {nav}
      <div className="view-summary">
        {components.map((c) => (
          <section className="setup-card" key={c.category}>
            <span className="eyebrow">{c.label}</span>
            <div className="view-score">{c.score === null ? "Pending" : `${c.score}/100`}</div>
            <p>{c.explanation}</p>
            <span className="fine-print">
              {c.evidence.monitorCount} configured checks / {c.evidence.resultCount} results
            </span>
          </section>
        ))}
        <section className="setup-card">
          <span className="eyebrow">CURRENT EVIDENCE</span>
          <div className="view-score">{issues.length}</div>
          <p>Active findings in the returned evidence set</p>
          <Link href="/dashboard#incidents-heading" className="quiet-link">
            Open incident queue
          </Link>
        </section>
      </div>
      <section className="setup-card">
        <h2>Recent check results</h2>
        <p>
          Latest available results for this category. This is a bounded snapshot, not a complete
          historical report.
        </p>
        {results.length === 0 ? (
          <div className="view-empty">
            <h3>No results available yet</h3>
            <p>
              Connect and verify a website, then configure a check to start collecting evidence.
            </p>
            <Link href="/dashboard#monitoring" className="button-primary mt-4">
              Configure checks
            </Link>
          </div>
        ) : (
          <div className="view-table-scroll">
            <table className="view-table">
              <thead>
                <tr>
                  <th>Website / check</th>
                  <th>Outcome</th>
                  <th>Response</th>
                  <th>Checked at</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.websiteName}
                      <small>{r.monitorType}</small>
                    </td>
                    <td>
                      <span className={r.status === "UP" ? "text-emerald-300" : "text-amber-300"}>
                        {r.status}
                      </span>
                      {r.httpStatusCode !== null && <small>HTTP {r.httpStatusCode}</small>}
                    </td>
                    <td>{r.responseTimeMs === null ? "Not measured" : `${r.responseTimeMs} ms`}</td>
                    <td>{new Date(r.checkedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="onboarding-grid">
        <section className="setup-card">
          <h2>Findings to review</h2>
          {issues.length === 0 ? (
            <p>
              No active findings in this snapshot. Missing results do not imply a healthy website.
            </p>
          ) : (
            issues.map((i) => (
              <article className="view-finding" key={i.id}>
                <span className="eyebrow">
                  {i.severity} / {i.status}
                </span>
                <h3>{i.title}</h3>
                <p>{i.summary}</p>
                {i.businessImpact && <p className="text-amber-200">{i.businessImpact}</p>}
                <span className="fine-print">{i.websiteName}</span>
              </article>
            ))
          )}
        </section>
        <section className="setup-card">
          <h2>Recommended next actions</h2>
          {recommendations.length === 0 ? (
            <p>No evidence-backed recommendations are available yet.</p>
          ) : (
            recommendations.map((r) => (
              <article className="view-finding" key={r.id}>
                <h3>{r.title}</h3>
                <p>{r.action}</p>
                <p>{r.rationale}</p>
              </article>
            ))
          )}
          <Link href="/dashboard#monitoring" className="quiet-link">
            Manage monitoring
          </Link>
        </section>
      </div>
      <aside className="view-limit">
        <span className="eyebrow">MEASUREMENT COVERAGE</span>
        <p>{config.limit}</p>
      </aside>
    </>
  );
}
