import tls from "node:tls";
import type { PgBoss } from "pg-boss";

import { getPrisma } from "@/db/client";
import { withGucContext } from "@/db/tenant";
import { recordFindingScoped, resolveFindingScoped, issueFingerprint } from "@/lib/issue-engine";
import { MONITOR_CHECK_JOB } from "@/lib/jobs/constants";
import type { MonitorCheckJob } from "@/lib/jobs/scheduler";

type MonitorCheckOutcome = {
  status: "UP" | "DOWN" | "ERROR";
  healthy: boolean;
  responseTimeMs: number;
  httpStatusCode?: number;
  errorMessage?: string;
  details: Record<string, string | number>;
  finding: {
    ruleId: string;
    severity: "CRITICAL" | "HIGH";
    title: string;
    summary: string;
  };
};

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

  return new Promise((resolve) => {
    const finish = (outcome: Omit<MonitorCheckOutcome, "responseTimeMs">) =>
      resolve({ ...outcome, responseTimeMs: Date.now() - startedAt });
    const socket = tls.connect({
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 443,
      servername: parsed.hostname,
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
        title: daysRemaining < 0 ? "SSL certificate has expired" : "SSL certificate expires soon",
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
  });
}

/** Registers the monitor execution handlers for uptime and SSL checks. */
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
            organizationId: true,
            websiteId: true,
            frequencyMinutes: true,
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
    if (job.data.type === "SSL") {
      outcome = await runSslCheck(target.website.normalizedUrl);
    } else {
      const startedAt = Date.now();
      let ok = false;
      let httpStatusCode: number | undefined;
      let errorMessage: string | undefined;
      try {
        const response = await fetch(target.website.normalizedUrl, {
          method: "HEAD",
          signal: AbortSignal.timeout(10_000),
        });
        ok = response.ok;
        httpStatusCode = response.status;
      } catch (error: unknown) {
        errorMessage =
          error instanceof Error ? error.message.slice(0, 500) : "Monitor request failed";
      }
      outcome = {
        status: ok ? "UP" : errorMessage === undefined ? "DOWN" : "ERROR",
        healthy: ok,
        responseTimeMs: Date.now() - startedAt,
        ...(httpStatusCode === undefined ? {} : { httpStatusCode }),
        ...(errorMessage === undefined ? {} : { errorMessage }),
        details: { checkType: job.data.type ?? "UPTIME" },
        finding: {
          ruleId: "monitor.uptime",
          severity: "HIGH",
          title: "Website is unreachable",
          summary: errorMessage ?? `Website returned HTTP ${httpStatusCode ?? "an error"}.`,
        },
      };
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

    const finding = {
      organizationId: job.data.organizationId,
      websiteId: target.website.id,
      monitorId: target.monitor.id,
      ruleId: outcome.finding.ruleId,
      subjectKey: target.website.id,
      severity: outcome.finding.severity,
      title: outcome.finding.title,
      summary: outcome.finding.summary,
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
  });
}
