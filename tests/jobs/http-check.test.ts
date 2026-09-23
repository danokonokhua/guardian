import { beforeEach, describe, expect, it, vi } from "vitest";

const requestSafeOutbound = vi.hoisted(() => vi.fn());
vi.mock("@/lib/security/outbound-url", () => ({ requestSafeOutbound }));

import { runHttpCheck } from "@/lib/jobs/http-check";

describe("HTTP monitoring contract", () => {
  beforeEach(() => {
    requestSafeOutbound.mockReset();
  });

  it.each([200, 204, 301, 302])("treats HTTP %s as reachable", async (status) => {
    requestSafeOutbound.mockResolvedValue({ ok: status >= 200 && status < 300, status });

    const outcome = await runHttpCheck("https://example.test");

    expect(outcome.status).toBe("UP");
    expect(outcome.healthy).toBe(true);
    expect(outcome.httpStatusCode).toBe(status);
    expect(outcome.details).toMatchObject({
      checkType: "UPTIME",
      statusClass: status >= 300 ? "redirect" : "success",
    });
    expect(outcome.finding.ruleId).toBe("monitor.uptime");
    expect(requestSafeOutbound).toHaveBeenCalledWith("https://example.test", {
      method: "HEAD",
      timeoutMs: 10_000,
      maxBodyBytes: 0,
    });
  });

  it.each([400, 404, 500, 503])("records HTTP %s as DOWN with an HTTP finding", async (status) => {
    requestSafeOutbound.mockResolvedValue({ ok: false, status });

    const outcome = await runHttpCheck("https://example.test");

    expect(outcome.status).toBe("DOWN");
    expect(outcome.healthy).toBe(false);
    expect(outcome.httpStatusCode).toBe(status);
    expect(outcome.finding).toMatchObject({
      ruleId: "monitor.http_status",
      title: "Website returned an unhealthy HTTP status",
      summary: `Website returned HTTP ${status}.`,
    });
  });

  it("distinguishes transport failures from HTTP responses", async () => {
    requestSafeOutbound.mockRejectedValue(new Error("Outbound request timed out."));

    const outcome = await runHttpCheck("https://example.test");

    expect(outcome.status).toBe("ERROR");
    expect(outcome.httpStatusCode).toBeUndefined();
    expect(outcome.errorMessage).toBe("Outbound request timed out.");
    expect(outcome.details).toMatchObject({ checkType: "UPTIME", failureClass: "transport" });
    expect(outcome.finding.ruleId).toBe("monitor.uptime");
  });
  it("does not claim an outage on a transport failure", async () => {
    requestSafeOutbound.mockRejectedValue(new Error("fetch failed"));
    expect(await runHttpCheck("https://example.test")).toMatchObject({
      status: "ERROR",
      finding: {
        title: "Website availability could not be confirmed",
        summary: expect.stringContaining("does not confirm an outage"),
      },
    });
  });

  it("keeps a slow successful response UP", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValueOnce(7000);
    try {
      requestSafeOutbound.mockResolvedValue({ status: 200 });
      expect(await runHttpCheck("https://example.test")).toMatchObject({
        status: "UP",
        healthy: true,
        responseTimeMs: 6000,
      });
    } finally {
      clock.mockRestore();
    }
  });
});
