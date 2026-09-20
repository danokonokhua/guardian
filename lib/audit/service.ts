import "server-only";

import { runHttpCheck } from "@/lib/jobs/http-check";
import { runPerformanceCheck } from "@/lib/jobs/performance-check";
import { runSecurityCheck } from "@/lib/jobs/security-check";
import { runSeoCheck } from "@/lib/jobs/seo-check";
import { calculateDigitalHealthScore, type DigitalHealthScore } from "@/lib/health-score";
import { resolveSafeOutboundUrl } from "@/lib/security/outbound-url";

const AUDIT_ADAPTERS = [
  { type: "UPTIME", run: runHttpCheck },
  { type: "PERFORMANCE", run: (url: string) => runPerformanceCheck(url) },
  { type: "SEO", run: runSeoCheck },
  { type: "SECURITY", run: runSecurityCheck },
] as const;

type AuditOutcome = Awaited<ReturnType<(typeof AUDIT_ADAPTERS)[number]["run"]>>;

export interface FreeAuditFinding {
  id: string;
  category: string;
  ruleId: string;
  severity: string;
  title: string;
  summary: string;
  responseTimeMs: number;
  httpStatusCode: number | null;
}

export interface FreeAuditResult {
  url: string;
  generatedAt: string;
  score: DigitalHealthScore;
  findings: FreeAuditFinding[];
  critical: FreeAuditFinding[];
  warnings: FreeAuditFinding[];
  opportunities: string[];
  limitations: string[];
}

function categoryForType(type: string): string {
  switch (type) {
    case "UPTIME":
      return "Website";
    case "PERFORMANCE":
      return "Performance";
    case "SEO":
      return "SEO";
    case "SECURITY":
      return "Security";
    default:
      return "Website";
  }
}

function findingFor(type: string, outcome: AuditOutcome, index: number): FreeAuditFinding | null {
  if (outcome.healthy) return null;
  return {
    id: `audit:${type.toLowerCase()}:${index + 1}`,
    category: categoryForType(type),
    ruleId: outcome.finding.ruleId,
    severity: outcome.finding.severity,
    title: outcome.finding.title.slice(0, 200),
    summary: outcome.finding.summary.slice(0, 1_000),
    responseTimeMs: Math.max(0, Math.round(outcome.responseTimeMs)),
    httpStatusCode: outcome.httpStatusCode ?? null,
  };
}

/** Runs the bounded, unauthenticated PRD free-audit contract in memory. */
export async function runFreeAudit(rawUrl: string): Promise<FreeAuditResult> {
  const target = await resolveSafeOutboundUrl(rawUrl);
  const url = target.url.toString();
  const generatedAt = new Date().toISOString();
  // Run the four top-level adapters sequentially. Shared-hosting targets can
  // throttle or stall when several homepage scans arrive together, producing
  // false transport findings. Security probes remain internally bounded.
  const outcomes: AuditOutcome[] = [];
  for (const { run } of AUDIT_ADAPTERS) outcomes.push(await run(url));
  const observations = outcomes.map((outcome, index) => ({
    id: `audit-result-${index + 1}`,
    monitorId: `audit-monitor-${index + 1}`,
    monitorType: AUDIT_ADAPTERS[index]!.type,
    status: outcome.status,
    checkedAt: generatedAt,
  }));
  const issues = outcomes.flatMap((outcome, index) => {
    const finding = findingFor(AUDIT_ADAPTERS[index]!.type, outcome, index);
    return finding === null
      ? []
      : [
          {
            id: finding.id,
            ruleId: finding.ruleId,
            severity: finding.severity,
            status: "OPEN",
            title: finding.title,
            summary: finding.summary,
            lastSeenAt: generatedAt,
          },
        ];
  });
  const score = calculateDigitalHealthScore(observations, issues, new Date(generatedAt));
  const findings = outcomes.flatMap((outcome, index) => {
    const finding = findingFor(AUDIT_ADAPTERS[index]!.type, outcome, index);
    return finding === null ? [] : [finding];
  });

  return {
    url,
    generatedAt,
    score,
    findings,
    critical: findings.filter(
      (finding) => finding.severity === "CRITICAL" || finding.severity === "HIGH",
    ),
    warnings: findings.filter(
      (finding) => finding.severity === "MEDIUM" || finding.severity === "LOW",
    ),
    opportunities: [
      "Connect your verified website to Guardian to monitor continuously and retain issue history.",
    ],
    limitations: [
      "This free audit is a bounded server-side snapshot; it does not submit forms, crawl the site, or measure browser Core Web Vitals.",
      "Lead-generation and reputation categories remain unmeasured until continuous monitoring or an approved integration is connected.",
    ],
  };
}
