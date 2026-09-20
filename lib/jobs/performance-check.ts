import "server-only";

import { performance } from "node:perf_hooks";

import type { MonitorCheckOutcome } from "@/lib/jobs/monitor-outcome";
import { requestSafeOutbound } from "@/lib/security/outbound-url";

export const PERFORMANCE_TIMEOUT_MS = 10_000;
export const PERFORMANCE_MAX_BODY_BYTES = 512 * 1024;
export const DEFAULT_MAX_RESPONSE_TIME_MS = 3_000;
export const MIN_MAX_RESPONSE_TIME_MS = 250;
export const MAX_MAX_RESPONSE_TIME_MS = 30_000;

function maxResponseTimeFromConfig(config: unknown): number {
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    return DEFAULT_MAX_RESPONSE_TIME_MS;
  }
  const candidate = (config as Record<string, unknown>).maxResponseTimeMs;
  return typeof candidate === "number" &&
    Number.isInteger(candidate) &&
    candidate >= MIN_MAX_RESPONSE_TIME_MS &&
    candidate <= MAX_MAX_RESPONSE_TIME_MS
    ? candidate
    : DEFAULT_MAX_RESPONSE_TIME_MS;
}

function failure(
  startedAt: number,
  status: "DOWN" | "ERROR",
  summary: string,
  failureClass: string,
  maxResponseTimeMs: number,
  httpStatusCode?: number,
  measuredResponseTimeMs?: number,
): MonitorCheckOutcome {
  const responseTimeMs =
    measuredResponseTimeMs ?? Math.max(0, Math.round(performance.now() - startedAt));
  return {
    status,
    healthy: false,
    responseTimeMs,
    ...(httpStatusCode === undefined ? {} : { httpStatusCode }),
    ...(status === "ERROR" ? { errorMessage: summary.slice(0, 500) } : {}),
    details: {
      checkType: "PERFORMANCE",
      metric: "server_response",
      elapsedMs: responseTimeMs,
      thresholdMs: maxResponseTimeMs,
      failureClass,
      ...(httpStatusCode === undefined ? {} : { httpStatusCode }),
    },
    finding: {
      ruleId: "monitor.performance",
      severity: "MEDIUM",
      title: "Website performance check failed",
      summary: summary.slice(0, 1_000),
    },
  };
}

/**
 * Runs the bounded Performance v1 contract: one server-side homepage request
 * and a configurable response-time threshold. It intentionally does not load
 * browser assets or claim Core Web Vitals/Lighthouse coverage.
 */
export async function runPerformanceCheck(
  url: string,
  config: unknown = {},
): Promise<MonitorCheckOutcome> {
  const startedAt = performance.now();
  const maxResponseTimeMs = maxResponseTimeFromConfig(config);

  let response;
  try {
    response = await requestSafeOutbound(url, {
      method: "GET",
      timeoutMs: PERFORMANCE_TIMEOUT_MS,
      maxBodyBytes: PERFORMANCE_MAX_BODY_BYTES,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Page request failed.";
    return failure(startedAt, "ERROR", message, "transport", maxResponseTimeMs);
  }

  // The shared request boundary already enforces the body limit. Reading the
  // bounded body here ensures a malformed/lazy response is treated as an
  // incomplete measurement without retaining any page content.
  try {
    await response.text();
  } catch {
    return failure(
      startedAt,
      "ERROR",
      "The homepage response could not be read for a performance measurement.",
      "unreadable_response",
      maxResponseTimeMs,
      response.status,
    );
  }

  const responseTimeMs = Math.max(0, Math.round(performance.now() - startedAt));
  if (response.status >= 300 && response.status < 400) {
    return failure(
      startedAt,
      "ERROR",
      `Homepage returned redirect HTTP ${response.status}; the performance check does not follow redirects.`,
      "redirect",
      maxResponseTimeMs,
      response.status,
      responseTimeMs,
    );
  }
  if (response.status < 200 || response.status >= 300) {
    return failure(
      startedAt,
      "DOWN",
      `Homepage returned HTTP ${response.status}.`,
      "http_status",
      maxResponseTimeMs,
      response.status,
      responseTimeMs,
    );
  }

  const healthy = responseTimeMs <= maxResponseTimeMs;
  return {
    status: healthy ? "UP" : "DOWN",
    healthy,
    responseTimeMs,
    httpStatusCode: response.status,
    details: {
      checkType: "PERFORMANCE",
      metric: "server_response",
      elapsedMs: responseTimeMs,
      thresholdMs: maxResponseTimeMs,
      failureClass: healthy ? "none" : "threshold_exceeded",
      httpStatusCode: response.status,
    },
    finding: {
      ruleId: "monitor.performance",
      severity: "MEDIUM",
      title: healthy
        ? "Website server response is within threshold"
        : "Website server response is above threshold",
      summary: healthy
        ? `The homepage server response completed in ${responseTimeMs} ms (threshold ${maxResponseTimeMs} ms).`
        : `The homepage server response took ${responseTimeMs} ms, above the ${maxResponseTimeMs} ms threshold.`,
    },
  };
}
