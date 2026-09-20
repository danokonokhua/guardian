import tls from "node:tls";
import type { PgBoss } from "pg-boss";

import { getPrisma } from "@/db/client";
import { withGucContext } from "@/db/tenant";
import { recordFindingScoped, resolveFindingScoped, issueFingerprint } from "@/lib/issue-engine";
import { MONITOR_CHECK_JOB } from "@/lib/jobs/constants";
import { pinnedLookup, resolveSafeOutboundUrl } from "@/lib/security/outbound-url";
import { runLinksCheck } from "@/lib/jobs/link-check";
import { runHttpCheck } from "@/lib/jobs/http-check";
import { runSeoCheck } from "@/lib/jobs/seo-check";
import { runSecurityCheck } from "@/lib/jobs/security-check";
import { runPerformanceCheck } from "@/lib/jobs/performance-check";
import { runFormCheck } from "@/lib/jobs/form-check";
import { captureHealthScoreSnapshot } from "@/services/health/repository";
import type { MonitorCheckOutcome } from "@/lib/jobs/monitor-outcome";
import type { MonitorCheckJob } from "@/lib/jobs/scheduler";

function sslFailure(
  startedAt: number,
  errorMessage: string,
  reason: string,
  summary: string,
): MonitorCheckOutcome {
  return {
    status: "ERROR",
    healthy: false,
    responseTimeMs: Date.now() - startedAt,
    errorMessage,
    details: { checkType: "SSL", reason },
    finding: {
      ruleId: "monitor.ssl",
      severity: "HIGH",
      title: "SSL certificate could not be checked",
      summary,
    },
  };
}

type FindingContext = {
  businessImpact: string;
  recommendedAction: string;
  impactConfidence: number;
};

const DEFAULT_FINDING_CONTEXT: Record<string, FindingContext> = {
  UPTIME: {
    businessImpact:
      "Customers may be unable to reach the website, interrupting discovery and revenue-generating journeys.",
    recommendedAction:
      "Open the website, then inspect hosting, DNS, TLS, and upstream provider status using the recorded evidence.",
    impactConfidence: 0.98,
  },
  SSL: {
    businessImpact:
      "An invalid or expiring certificate can block visitors or trigger browser warnings on the website.",
    recommendedAction:
      "Renew or replace the certificate before expiry and confirm the complete certificate chain on the monitored hostname.",
    impactConfidence: 0.98,
  },
  SECURITY: {
    businessImpact:
      "Missing security headers or exposed configuration can increase visitor risk and reduce trust in the business website.",
    recommendedAction:
      "Review the bounded security evidence, remove exposed configuration, and configure the missing headers at the web server or application boundary.",
    impactConfidence: 0.9,
  },
  LINKS: {
    businessImpact:
      "Broken navigation or calls-to-action can prevent visitors from reaching important pages and conversion paths.",
    recommendedAction:
      "Open the recorded failing URLs, restore the intended destinations, and re-run the bounded same-origin link check.",
    impactConfidence: 0.9,
  },
  SEO: {
    businessImpact:
      "Missing on-page or indexability signals can reduce organic discoverability for the business website.",
    recommendedAction:
      "Use the recorded failed checks to update the page metadata, canonical, robots, or sitemap and then re-run the SEO check.",
    impactConfidence: 0.85,
  },
  PERFORMANCE: {
    businessImpact:
      "Slow or unavailable page responses can increase visitor abandonment before a customer reaches a conversion path.",
    recommendedAction:
      "Inspect server, database, cache, and hosting response time using the recorded threshold evidence, then re-run the check after remediation.",
    impactConfidence: 0.85,
  },
  FORM: {
    businessImpact:
      "A monitored lead-form workflow may be unavailable, which can prevent the business from receiving enquiries.",
    recommendedAction:
      "Open the configured page and form, confirm the safe probe endpoint, and verify the site's lead delivery path.",
    impactConfidence: 0.95,
  },
};

function runSslCheck(url: string): Promise<MonitorCheckOutcome> {
  const startedAt = Date.now();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return Promise.resolve(
      sslFailure(
        startedAt,
        "Website URL is invalid.",
        "invalid_url",
        "Guardian could not parse the configured website URL.",
      ),
    );
  }
  if (parsed.protocol !== "https:") {
    return Promise.resolve(
      sslFailure(
        startedAt,
        "SSL checks require an HTTPS website URL.",
        "https_required",
        "The configured website URL does not use HTTPS, so no TLS certificate is available.",
      ),
    );
  }

  return resolveSafeOutboundUrl(url)
    .then(
      (target) =>
        new Promise<MonitorCheckOutcome>((resolve) => {
          const finish = (outcome: Omit<MonitorCheckOutcome, "responseTimeMs">) =>
            resolve({ ...outcome, responseTimeMs: Date.now() - startedAt });
          const socket = tls.connect({
            host: target.hostname,
            port: parsed.port ? Number(parsed.port) : 443,
            servername: target.hostname,
            lookup: pinnedLookup(target),
            rejectUnauthorized: false,
          });
          socket.setTimeout(10_000, () => {
            socket.destroy();
            finish(
              sslFailure(
                startedAt,
                "TLS connection timed out.",
                "timeout",
                "Guardian could not establish a TLS connection before the timeout.",
              ),
            );
          });
          socket.once("error", (error: Error) => {
            finish(
              sslFailure(
                startedAt,
                error.message.slice(0, 500),
                "tls_error",
                "Guardian could not establish a TLS connection to the website.",
              ),
            );
          });
          socket.once("secureConnect", () => {
            const certificate = socket.getPeerCertificate();
            socket.end();
            const expiresAt = Date.parse(certificate.valid_to ?? "");
            if (Number.isNaN(expiresAt)) {
              finish(
                sslFailure(
                  startedAt,
                  "TLS certificate expiry could not be read.",
                  "missing_expiry",
                  "The website presented a TLS certificate without a readable expiry date.",
                ),
              );
              return;
            }
            const daysRemaining = Math.floor((expiresAt - Date.now()) / 86_400_000);
            const expiresAtIso = new Date(expiresAt).toISOString();
            const finding = {
              ruleId: "monitor.ssl",
              severity: daysRemaining < 0 ? ("CRITICAL" as const) : ("HIGH" as const),
              title:
                daysRemaining < 0 ? "SSL certificate has expired" : "SSL certificate expires soon",
              summary:
                daysRemaining < 0
                  ? "The website's TLS certificate has expired."
                  : `The website's TLS certificate expires in ${daysRemaining} days.`,
            };
            finish({
              status: daysRemaining < 0 ? "DOWN" : "UP",
              healthy: daysRemaining > 30,
              details: { checkType: "SSL", expiresAt: expiresAtIso, daysRemaining },
              finding,
            });
          });
        }),
    )
    .catch(() =>
      sslFailure(
        startedAt,
        "Website URL must resolve to a public address.",
        "unsafe_destination",
        "Guardian refused to connect to a non-public monitoring destination.",
      ),
    );
}

/** Registers the monitor execution handlers for the worker-backed monitor adapters. */
export async function registerMonitorCheckWorker(boss: PgBoss): Promise<void> {
  await boss.createQueue(MONITOR_CHECK_JOB);
  await boss.work<MonitorCheckJob>(MONITOR_CHECK_JOB, async ([job]) => {
    if (!job) return;
    const prisma = getPrisma();
    const target = await withGucContext(
      { organizationId: job.data.organizationId },
      async (tx) => {
        const monitor = await tx.monitor.findFirst({
          where: { id: job.data.monitorId, organizationId: job.data.organizationId },
          select: {
            id: true,
            enabled: true,
            type: true,
            organizationId: true,
            websiteId: true,
            frequencyMinutes: true,
            config: true,
          },
        });
        if (!monitor || !monitor.enabled || monitor.websiteId !== job.data.websiteId) return null;
        const website = await tx.website.findFirst({
          where: { id: job.data.websiteId, organizationId: job.data.organizationId },
          select: { id: true, normalizedUrl: true, verifyStatus: true },
        });
        return website?.verifyStatus === "VERIFIED" ? { monitor, website } : null;
      },
      prisma,
    );
    if (!target) return;

    let outcome: MonitorCheckOutcome;
    // The database record is authoritative when available.  Older queued jobs
    // may omit `type`, so retain the historical UPTIME default only for an
    // absent value; arbitrary unknown types are ignored instead of silently
    // running the wrong adapter.
    const monitorType = target.monitor.type ?? job.data.type ?? "UPTIME";
    if (monitorType === "SSL") {
      outcome = await runSslCheck(target.website.normalizedUrl);
    } else if (monitorType === "SECURITY") {
      outcome = await runSecurityCheck(target.website.normalizedUrl);
    } else if (monitorType === "LINKS") {
      outcome = await runLinksCheck(target.website.normalizedUrl, target.monitor.config);
    } else if (monitorType === "SEO") {
      outcome = await runSeoCheck(target.website.normalizedUrl);
    } else if (monitorType === "PERFORMANCE") {
      outcome = await runPerformanceCheck(target.website.normalizedUrl, target.monitor.config);
    } else if (monitorType === "FORM") {
      outcome = await runFormCheck(target.website.normalizedUrl, target.monitor.config);
    } else if (monitorType === "UPTIME") {
      outcome = await runHttpCheck(target.website.normalizedUrl);
    } else {
      return;
    }

    await withGucContext(
      { organizationId: job.data.organizationId },
      async (tx) => {
        await tx.monitoringResult.create({
          data: {
            organizationId: job.data.organizationId,
            monitorId: target.monitor.id,
            websiteId: target.website.id,
            status: outcome.status,
            responseTimeMs: outcome.responseTimeMs,
            httpStatusCode: outcome.httpStatusCode,
            errorMessage: outcome.errorMessage,
            details: outcome.details,
          },
        });
        await tx.monitor.update({
          where: { id: target.monitor.id },
          data: {
            lastRunAt: new Date(),
            nextRunAt: new Date(Date.now() + target.monitor.frequencyMinutes * 60_000),
            consecutiveFailures: outcome.healthy ? 0 : { increment: 1 },
          },
        });
        await tx.website.update({
          where: { id: target.website.id },
          data: { lastCheckedAt: new Date() },
        });
      },
      prisma,
    );

    const context = DEFAULT_FINDING_CONTEXT[monitorType];
    const businessImpact =
      outcome.finding.businessImpact ?? (outcome.healthy ? undefined : context?.businessImpact);
    const recommendedAction =
      outcome.finding.recommendedAction ??
      (outcome.healthy ? undefined : context?.recommendedAction);
    const impactConfidence =
      outcome.finding.impactConfidence ?? (outcome.healthy ? undefined : context?.impactConfidence);
    const finding = {
      organizationId: job.data.organizationId,
      websiteId: target.website.id,
      monitorId: target.monitor.id,
      ruleId: outcome.finding.ruleId,
      subjectKey: target.website.id,
      severity: outcome.finding.severity,
      title: outcome.finding.title,
      summary: outcome.finding.summary,
      ...(businessImpact === undefined ? {} : { businessImpact }),
      ...(recommendedAction === undefined ? {} : { recommendedAction }),
      ...(impactConfidence === undefined ? {} : { impactConfidence }),
      technicalEvidence: {
        ...outcome.details,
        status: outcome.status,
        responseTimeMs: outcome.responseTimeMs,
        ...(outcome.httpStatusCode === undefined ? {} : { httpStatusCode: outcome.httpStatusCode }),
        ...(outcome.errorMessage === undefined ? {} : { errorMessage: outcome.errorMessage }),
      },
    };
    if (outcome.healthy) {
      await resolveFindingScoped(
        { organizationId: job.data.organizationId },
        issueFingerprint(finding),
        prisma,
      );
    } else {
      await recordFindingScoped({ organizationId: job.data.organizationId }, finding, prisma);
    }
    await captureHealthScoreSnapshot({ organizationId: job.data.organizationId }, prisma);
  });
}
