import "server-only";

import type { MonitorCheckOutcome } from "@/lib/jobs/monitor-outcome";
import { requestSafeOutbound } from "@/lib/security/outbound-url";

/**
 * Basic security monitor limits.
 *
 * This is intentionally a small, deterministic surface.  It is a hygiene
 * check for a verified website, not a vulnerability scanner or penetration
 * test.  In particular, the probe paths below are fixed and same-origin;
 * callers cannot supply arbitrary paths or payloads.
 */
const REQUEST_TIMEOUT_MS = 10_000;
const PAGE_MAX_BODY_BYTES = 512 * 1024;
const PROBE_MAX_BODY_BYTES = 8 * 1024;
const MIN_HSTS_MAX_AGE_SECONDS = 15_552_000; // six months

type SecurityFailure = { check: string; message: string };
type ProbeDefinition = { id: string; path: string };
type ProbeObservation = {
  id: string;
  path: string;
  status: number;
  exposed: boolean;
  error: boolean;
};

function isVerificationPage(body: string): boolean {
  return /one moment, please|please wait while your request is being verified|checking your browser/i.test(
    body,
  );
}

/** Fixed, high-confidence paths only; never accept paths from monitor config. */
export const SECURITY_PROBE_PATHS: readonly ProbeDefinition[] = [
  { id: "env", path: "/.env" },
  { id: "env_production", path: "/.env.production" },
  { id: "git_head", path: "/.git/HEAD" },
  { id: "wp_config", path: "/wp-config.php" },
  { id: "phpinfo", path: "/phpinfo.php" },
  { id: "server_status", path: "/server-status" },
];

function responseHeader(
  headers: Readonly<Record<string, string>> | undefined,
  name: string,
): string | undefined {
  const expected = name.toLowerCase();
  return Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === expected)?.[1];
}

function headerPresent(value: string | undefined): number {
  return value !== undefined && value.trim() !== "" ? 1 : 0;
}

function hasNoSniff(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "nosniff";
}

function hasHsts(value: string | undefined): boolean {
  if (value === undefined) return false;
  const match = /(?:^|;)\s*max-age\s*=\s*(\d+)\s*(?:;|$)/i.exec(value);
  if (match === null) return false;
  const maxAge = Number(match[1]);
  return Number.isSafeInteger(maxAge) && maxAge >= MIN_HSTS_MAX_AGE_SECONDS;
}

function hasCspDirective(value: string | undefined, directive: string): boolean {
  if (value === undefined || value.trim() === "") return false;
  return new RegExp(`(?:^|;)\\s*${directive}\\b`, "i").test(value);
}

function hasEnforcedCsp(value: string | undefined): boolean {
  // A non-empty policy with at least one recognised directive is sufficient
  // for this bounded hygiene check.  We intentionally do not attempt to
  // judge whether every individual source expression is safe.
  return ["default-src", "script-src", "object-src", "base-uri", "frame-ancestors"].some(
    (directive) => hasCspDirective(value, directive),
  );
}

function hasFrameProtection(xFrameOptions: string | undefined, csp: string | undefined): boolean {
  const normalized = xFrameOptions?.trim().toLowerCase();
  if (normalized === "deny" || normalized === "sameorigin") return true;
  if (csp === undefined) return false;
  const match = /(?:^|;)\s*frame-ancestors\s+([^;]+)/i.exec(csp);
  return match !== null && match[1]!.trim().length > 0;
}

function envSignature(body: string): boolean {
  // Require a high-signal secret/config key so a custom 200 page containing a
  // generic `FOO=bar` string is not reported. One such assignment is enough:
  // real leaked `.env` files are often intentionally minimal.
  const assignments = body.match(/^\s*[A-Z][A-Z0-9_]{1,63}\s*=\s*[^\r\n]*$/gim) ?? [];
  return assignments.some((line) =>
    /(?:DATABASE_URL|DB_PASSWORD|API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY|SMTP_)/i.test(line),
  );
}

function exposedBySignature(id: string, body: string): boolean {
  switch (id) {
    case "env":
    case "env_production":
      return envSignature(body);
    case "git_head":
      return /^\s*ref:\s+refs\/heads\/[\w./-]+\s*$/im.test(body);
    case "wp_config":
      return /<\?php|(?:DB_(?:NAME|USER|PASSWORD|HOST))|define\s*\(\s*["']DB_/i.test(body);
    case "phpinfo":
      return /phpinfo\s*\(|PHP\s+Version|PHP\s+Variables|_SERVER\s*\[/i.test(body);
    case "server_status":
      return /Apache\s+Server\s+Status|Server\s+Version|Scoreboard|mod_status/i.test(body);
    default:
      return false;
  }
}

function pageFailure(
  startedAt: number,
  status: "DOWN" | "ERROR",
  message: string,
  httpStatusCode?: number,
): MonitorCheckOutcome {
  return {
    status,
    healthy: false,
    responseTimeMs: Math.max(0, Date.now() - startedAt),
    ...(httpStatusCode === undefined ? {} : { httpStatusCode }),
    ...(status === "ERROR" ? { errorMessage: message.slice(0, 500) } : {}),
    details: {
      checkType: "SECURITY",
      failureCount: 1,
      failedChecks: "page",
      ...(httpStatusCode === undefined ? {} : { httpStatusCode }),
    },
    finding: {
      ruleId: "monitor.security",
      severity: "MEDIUM",
      title: "Basic security scan could not be completed",
      summary: message.slice(0, 1_000),
    },
  };
}

function securityOutcome(
  startedAt: number,
  pageStatus: number,
  failures: SecurityFailure[],
  observations: ProbeObservation[],
  headers: Readonly<Record<string, string>> | undefined,
  pageUrl: URL,
  probeErrors: string[],
): MonitorCheckOutcome {
  const exposures = observations.filter((probe) => probe.exposed);
  const failedChecks = [...new Set(failures.map(({ check }) => check))];
  if (exposures.length > 0) failedChecks.push("exposed_configuration");
  if (probeErrors.length > 0) failedChecks.push("probe_transport");

  const healthy = failedChecks.length === 0;
  // A confirmed exposed configuration is materially more urgent than a
  // missing browser-hardening header.  Scanner uncertainty stays MEDIUM.
  const severity = exposures.length > 0 ? ("HIGH" as const) : ("MEDIUM" as const);
  const status = healthy
    ? "UP"
    : probeErrors.length > 0 && failures.length === 0 && exposures.length === 0
      ? "ERROR"
      : "DOWN";

  const probeStatuses = observations
    .map(({ id, status: probeStatus }) => `${id}:${probeStatus}`)
    .join(",");
  const exposedPaths = exposures.map(({ id }) => id).join(",");
  const errors = [...new Set(probeErrors)].join(",");
  const hsts = responseHeader(headers, "strict-transport-security");
  const csp = responseHeader(headers, "content-security-policy");
  const reportOnlyCsp = responseHeader(headers, "content-security-policy-report-only");
  const xFrameOptions = responseHeader(headers, "x-frame-options");
  const referrerPolicy = responseHeader(headers, "referrer-policy");
  const permissionsPolicy = responseHeader(headers, "permissions-policy");
  const summary = healthy
    ? "The homepage passed Guardian's bounded basic security checks."
    : exposures.length > 0
      ? `Potentially exposed configuration was detected at ${exposedPaths}. Guardian's basic checks are not a complete cybersecurity assessment.`
      : failures
          .map(({ message }) => message)
          .concat(
            probeErrors.length > 0 ? ["One or more security probes could not be completed."] : [],
          )
          .join(" ")
          .slice(0, 1_000);

  return {
    status,
    healthy,
    responseTimeMs: Math.max(0, Date.now() - startedAt),
    httpStatusCode: pageStatus,
    ...(status === "ERROR"
      ? { errorMessage: "One or more bounded security probes could not be completed." }
      : {}),
    details: {
      checkType: "SECURITY",
      failureCount: failedChecks.length,
      failedChecks: failedChecks.join(",") || "none",
      pageProtocol: pageUrl.protocol,
      hsts: hasHsts(hsts) ? 1 : 0,
      csp: hasEnforcedCsp(csp) ? 1 : 0,
      cspReportOnly: headerPresent(reportOnlyCsp),
      noSniff: hasNoSniff(responseHeader(headers, "x-content-type-options")) ? 1 : 0,
      frameProtection: hasFrameProtection(xFrameOptions, csp) ? 1 : 0,
      referrerPolicy: headerPresent(referrerPolicy),
      permissionsPolicy: headerPresent(permissionsPolicy),
      probeCount: observations.length,
      probeStatuses: probeStatuses.slice(0, 1_000),
      exposedCount: exposures.length,
      exposedPaths: exposedPaths || "none",
      probeErrors: errors || "none",
    },
    finding: {
      ruleId: "monitor.security",
      severity,
      title: healthy ? "Basic security checks passed" : "Basic security checks failed",
      summary,
    },
  };
}

/**
 * Runs the PRD's bounded Basic Security v1 checks for one verified homepage.
 *
 * The homepage response supplies security headers.  A fixed set of same-origin
 * paths is then requested once each to identify high-confidence exposed
 * configuration.  Probe response bodies are used only for in-memory signature
 * matching and are never returned, logged, or persisted as evidence.
 */
export async function runSecurityCheck(url: string): Promise<MonitorCheckOutcome> {
  const startedAt = Date.now();
  let pageUrl: URL;
  try {
    pageUrl = new URL(url);
  } catch {
    return pageFailure(startedAt, "ERROR", "The configured website URL is invalid.");
  }

  let page;
  try {
    page = await requestSafeOutbound(pageUrl.toString(), {
      method: "GET",
      timeoutMs: REQUEST_TIMEOUT_MS,
      maxBodyBytes: PAGE_MAX_BODY_BYTES,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Page request failed.";
    return pageFailure(startedAt, "ERROR", message);
  }

  if (page.status < 200 || page.status >= 300) {
    const isRedirect = page.status >= 300 && page.status < 400;
    return pageFailure(
      startedAt,
      isRedirect || page.status === 0 ? "ERROR" : "DOWN",
      isRedirect
        ? `Homepage returned redirect HTTP ${page.status}; the security scanner does not follow redirects.`
        : `Homepage returned HTTP ${page.status}.`,
      page.status,
    );
  }

  // Force the bounded body reader to finish, but do not retain or expose the
  // homepage body.  Header checks do not depend on HTML parsing.
  try {
    await page.text();
  } catch {
    return pageFailure(startedAt, "ERROR", "The homepage response could not be read.", page.status);
  }

  const failures: SecurityFailure[] = [];
  const hsts = responseHeader(page.headers, "strict-transport-security");
  const csp = responseHeader(page.headers, "content-security-policy");
  const reportOnlyCsp = responseHeader(page.headers, "content-security-policy-report-only");
  const noSniff = responseHeader(page.headers, "x-content-type-options");
  const xFrameOptions = responseHeader(page.headers, "x-frame-options");

  if (pageUrl.protocol !== "https:") {
    failures.push({ check: "https", message: "The monitored website does not use HTTPS." });
  } else if (!hasHsts(hsts)) {
    failures.push({
      check: "hsts",
      message:
        "The HTTPS homepage does not send a sufficiently long Strict-Transport-Security policy.",
    });
  }
  if (!hasEnforcedCsp(csp)) {
    failures.push({
      check: "csp",
      message:
        reportOnlyCsp === undefined
          ? "The homepage does not send an enforced Content-Security-Policy header."
          : "The homepage sends only a report-only Content-Security-Policy header.",
    });
  }
  if (!hasNoSniff(noSniff)) {
    failures.push({
      check: "nosniff",
      message: "The homepage does not send X-Content-Type-Options: nosniff.",
    });
  }
  if (!hasFrameProtection(xFrameOptions, csp)) {
    failures.push({
      check: "frame_protection",
      message: "The homepage has no X-Frame-Options or CSP frame-ancestors protection.",
    });
  }

  const probeResults = await Promise.all(
    SECURITY_PROBE_PATHS.map(async (probe) => {
      const probeUrl = new URL(probe.path, pageUrl.origin).toString();
      try {
        const response = await requestSafeOutbound(probeUrl, {
          method: "GET",
          timeoutMs: REQUEST_TIMEOUT_MS,
          maxBodyBytes: PROBE_MAX_BODY_BYTES,
          truncateBody: true,
        });
        let exposed = false;
        let error = false;
        if (response.status >= 200 && response.status < 300) {
          try {
            // The body exists only for this in-memory signature check. Never
            // place it in details, errors, logs, or issue evidence.
            const body = await response.text();
            if (response.bodyTruncated || isVerificationPage(body)) {
              error = true;
            } else {
              exposed = exposedBySignature(probe.id, body.slice(0, PROBE_MAX_BODY_BYTES));
            }
          } catch {
            error = true;
          }
        }
        // Redirects and server failures do not prove that a sensitive path is
        // absent; treat them as incomplete probe evidence.
        if (
          response.status === 0 ||
          (response.status >= 300 && response.status < 400) ||
          response.status >= 500
        ) {
          error = true;
        }
        return {
          observation: {
            id: probe.id,
            path: probe.path,
            status: response.status,
            exposed,
            error,
          },
          error,
        };
      } catch {
        return {
          observation: { id: probe.id, path: probe.path, status: 0, exposed: false, error: true },
          error: true,
        };
      }
    }),
  );
  const observations = probeResults.map(({ observation }) => observation);
  const probeErrors = probeResults
    .filter(({ error }) => error)
    .map(({ observation }) => observation.id);

  return securityOutcome(
    startedAt,
    page.status,
    failures,
    observations,
    page.headers,
    pageUrl,
    probeErrors,
  );
}
