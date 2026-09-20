import { beforeEach, describe, expect, it, vi } from "vitest";

const performanceNow = vi.hoisted(() => vi.fn());
vi.mock("node:perf_hooks", () => ({ performance: { now: performanceNow } }));

const requestSafeOutbound = vi.hoisted(() => vi.fn());
vi.mock("@/lib/security/outbound-url", () => ({ requestSafeOutbound }));

import {
  DEFAULT_MAX_RESPONSE_TIME_MS,
  PERFORMANCE_MAX_BODY_BYTES,
  PERFORMANCE_TIMEOUT_MS,
  runPerformanceCheck,
} from "@/lib/jobs/performance-check";

function response(
  status: number,
  body = "<html>page</html>",
  text: () => Promise<string> = async () => body,
) {
  return { ok: status >= 200 && status < 300, status, text };
}

describe("Performance v1 monitor", () => {
  beforeEach(() => {
    requestSafeOutbound.mockReset();
    performanceNow.mockReset();
  });

  it("records a fast successful server response", async () => {
    performanceNow.mockReturnValueOnce(1_000).mockReturnValueOnce(1_425);
    requestSafeOutbound.mockResolvedValue(response(200));

    const outcome = await runPerformanceCheck("https://example.test/");

    expect(outcome).toMatchObject({
      status: "UP",
      healthy: true,
      responseTimeMs: 425,
      httpStatusCode: 200,
      details: {
        checkType: "PERFORMANCE",
        metric: "server_response",
        elapsedMs: 425,
        thresholdMs: DEFAULT_MAX_RESPONSE_TIME_MS,
        failureClass: "none",
      },
      finding: { ruleId: "monitor.performance", severity: "MEDIUM" },
    });
    expect(requestSafeOutbound).toHaveBeenCalledWith("https://example.test/", {
      method: "GET",
      timeoutMs: PERFORMANCE_TIMEOUT_MS,
      maxBodyBytes: PERFORMANCE_MAX_BODY_BYTES,
    });
  });

  it("marks a response above the configured threshold as DOWN", async () => {
    performanceNow.mockReturnValueOnce(0).mockReturnValueOnce(2_501);
    requestSafeOutbound.mockResolvedValue(response(200, "sensitive page body"));

    const outcome = await runPerformanceCheck("https://example.test/", {
      maxResponseTimeMs: 2_500,
    });

    expect(outcome.status).toBe("DOWN");
    expect(outcome.healthy).toBe(false);
    expect(outcome.responseTimeMs).toBe(2_501);
    expect(outcome.details).toMatchObject({
      thresholdMs: 2_500,
      failureClass: "threshold_exceeded",
    });
    expect(JSON.stringify(outcome)).not.toContain("sensitive page body");
    expect(outcome.finding.summary).toContain("2501 ms");
  });

  it.each([400, 404, 500, 503])("marks HTTP %s as DOWN", async (status) => {
    performanceNow.mockReturnValueOnce(0).mockReturnValueOnce(100).mockReturnValueOnce(100);
    requestSafeOutbound.mockResolvedValue(response(status));

    const outcome = await runPerformanceCheck("https://example.test/");

    expect(outcome).toMatchObject({
      status: "DOWN",
      healthy: false,
      httpStatusCode: status,
      details: { failureClass: "http_status", httpStatusCode: status },
      finding: { ruleId: "monitor.performance" },
    });
  });

  it("does not follow redirects and records an incomplete measurement", async () => {
    performanceNow.mockReturnValueOnce(0).mockReturnValueOnce(200);
    requestSafeOutbound.mockResolvedValue(response(302));

    const outcome = await runPerformanceCheck("https://example.test/");

    expect(outcome).toMatchObject({
      status: "ERROR",
      healthy: false,
      httpStatusCode: 302,
      details: { failureClass: "redirect", httpStatusCode: 302 },
    });
    expect(outcome.finding.summary).toContain("does not follow redirects");
  });

  it("classifies transport and unreadable responses as ERROR", async () => {
    performanceNow.mockReturnValueOnce(0).mockReturnValueOnce(10);
    requestSafeOutbound.mockRejectedValue(new Error("Outbound request timed out."));
    await expect(runPerformanceCheck("https://example.test/")).resolves.toMatchObject({
      status: "ERROR",
      details: { failureClass: "transport" },
      errorMessage: "Outbound request timed out.",
    });

    performanceNow.mockReset().mockReturnValueOnce(0).mockReturnValueOnce(25);
    requestSafeOutbound.mockResolvedValue(
      response(200, "", async () => Promise.reject(new Error("body read failed"))),
    );
    await expect(runPerformanceCheck("https://example.test/")).resolves.toMatchObject({
      status: "ERROR",
      details: { failureClass: "unreadable_response", httpStatusCode: 200 },
    });
  });

  it("uses the safe default when an invalid threshold reaches the adapter", async () => {
    performanceNow.mockReturnValueOnce(0).mockReturnValueOnce(100);
    requestSafeOutbound.mockResolvedValue(response(200));

    const outcome = await runPerformanceCheck("https://example.test/", {
      maxResponseTimeMs: 1,
    });

    expect(outcome.details.thresholdMs).toBe(DEFAULT_MAX_RESPONSE_TIME_MS);
  });
});
