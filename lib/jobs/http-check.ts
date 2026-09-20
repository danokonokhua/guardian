import "server-only";

import { requestSafeOutbound } from "@/lib/security/outbound-url";
import type { MonitorCheckOutcome } from "@/lib/jobs/monitor-outcome";

export type HttpCheckOutcome = MonitorCheckOutcome;

function statusClass(status: number): string {
  if (status >= 200 && status < 300) return "success";
  if (status >= 300 && status < 400) return "redirect";
  if (status >= 400 && status < 500) return "client_error";
  if (status >= 500 && status < 600) return "server_error";
  return "unknown";
}

/**
 * HTTP monitoring contract:
 * - 2xx and 3xx responses are reachable and therefore UP.
 * - 4xx and 5xx responses are DOWN with a distinct HTTP-status finding.
 * - DNS, connection, TLS, timeout, and outbound-policy failures are ERROR.
 * - responseTimeMs measures the complete bounded request duration.
 */
export async function runHttpCheck(url: string): Promise<HttpCheckOutcome> {
  const startedAt = Date.now();
  try {
    const response = await requestSafeOutbound(url, {
      method: "HEAD",
      timeoutMs: 10_000,
      maxBodyBytes: 0,
    });
    const responseTimeMs = Math.max(0, Date.now() - startedAt);
    const httpStatusCode = response.status;
    const healthy = httpStatusCode >= 200 && httpStatusCode < 400;
    const className = statusClass(httpStatusCode);

    return {
      status: healthy ? "UP" : "DOWN",
      healthy,
      responseTimeMs,
      httpStatusCode,
      details: { checkType: "UPTIME", httpStatusCode, statusClass: className },
      finding: healthy
        ? {
            ruleId: "monitor.uptime",
            severity: "HIGH",
            title: "Website is unreachable",
            summary: "The website did not respond successfully.",
          }
        : {
            ruleId: "monitor.http_status",
            severity: "HIGH",
            title: "Website returned an unhealthy HTTP status",
            summary: `Website returned HTTP ${httpStatusCode}.`,
          },
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message.slice(0, 500) : "Monitor request failed";
    return {
      status: "ERROR",
      healthy: false,
      responseTimeMs: Math.max(0, Date.now() - startedAt),
      errorMessage,
      details: { checkType: "UPTIME", failureClass: "transport" },
      finding: {
        ruleId: "monitor.uptime",
        severity: "HIGH",
        title: "Website is unreachable",
        summary: errorMessage,
      },
    };
  }
}
