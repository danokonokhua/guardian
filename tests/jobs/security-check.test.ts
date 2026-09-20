import { beforeEach, describe, expect, it, vi } from "vitest";

import { SECURITY_PROBE_PATHS, runSecurityCheck } from "@/lib/jobs/security-check";

const requestSafeOutbound = vi.hoisted(() => vi.fn());
vi.mock("@/lib/security/outbound-url", () => ({ requestSafeOutbound }));

const SECURE_HEADERS = {
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "content-security-policy": "default-src 'self'; frame-ancestors 'none'",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=()",
};

function response(
  status: number,
  body = "",
  headers: Record<string, string> = {},
): { ok: boolean; status: number; text: () => Promise<string>; headers: Record<string, string> } {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
    headers,
  };
}

function queuePage(
  headers: Record<string, string> = SECURE_HEADERS,
  status = 200,
  body = "<html><head><title>Guardian</title></head><body>Home</body></html>",
): void {
  requestSafeOutbound.mockResolvedValueOnce(response(status, body, headers));
}

function queueProbes(
  statuses: number[] = Array.from({ length: SECURITY_PROBE_PATHS.length }, () => 404),
  bodies: Record<string, string> = {},
): void {
  SECURITY_PROBE_PATHS.forEach((probe, index) => {
    const status = statuses[index] ?? 404;
    requestSafeOutbound.mockResolvedValueOnce(response(status, bodies[probe.id] ?? ""));
  });
}

describe("basic security monitor", () => {
  beforeEach(() => requestSafeOutbound.mockReset());

  it("passes secure headers with protected or missing probe paths", async () => {
    queuePage();
    queueProbes();

    const outcome = await runSecurityCheck("https://example.test/");

    expect(outcome).toMatchObject({
      status: "UP",
      healthy: true,
      httpStatusCode: 200,
      details: {
        checkType: "SECURITY",
        failedChecks: "none",
        exposedCount: 0,
        exposedPaths: "none",
      },
      finding: { ruleId: "monitor.security", severity: "MEDIUM" },
    });
    expect(requestSafeOutbound).toHaveBeenCalledTimes(1 + SECURITY_PROBE_PATHS.length);
    expect(requestSafeOutbound).toHaveBeenNthCalledWith(1, "https://example.test/", {
      method: "GET",
      timeoutMs: 10_000,
      maxBodyBytes: 512 * 1024,
    });
    SECURITY_PROBE_PATHS.forEach((probe, index) => {
      expect(requestSafeOutbound).toHaveBeenNthCalledWith(
        index + 2,
        `https://example.test${probe.path}`,
        { method: "GET", timeoutMs: 10_000, maxBodyBytes: 8 * 1024, truncateBody: true },
      );
    });
  });

  it("reports missing or weak baseline headers without claiming a vulnerability", async () => {
    queuePage({});
    queueProbes();

    const outcome = await runSecurityCheck("https://example.test/");

    expect(outcome.status).toBe("DOWN");
    expect(outcome.healthy).toBe(false);
    expect(outcome.finding).toMatchObject({ ruleId: "monitor.security", severity: "MEDIUM" });
    expect(outcome.details.failedChecks).toContain("hsts");
    expect(outcome.details.failedChecks).toContain("csp");
    expect(outcome.details.failedChecks).toContain("nosniff");
    expect(outcome.details.failedChecks).toContain("frame_protection");
  });

  it("accepts CSP frame-ancestors as clickjacking protection without X-Frame-Options", async () => {
    queuePage({
      ...SECURE_HEADERS,
      "x-frame-options": "",
      "content-security-policy": "default-src 'self'; frame-ancestors https://example.test",
    });
    queueProbes();

    const outcome = await runSecurityCheck("https://example.test/");

    expect(outcome.status).toBe("UP");
    expect(outcome.details.frameProtection).toBe(1);
  });

  it("rejects a report-only CSP as an enforced policy", async () => {
    const withoutCsp = Object.fromEntries(
      Object.entries(SECURE_HEADERS).filter(([name]) => name !== "content-security-policy"),
    );
    queuePage({
      ...withoutCsp,
      "content-security-policy-report-only": "default-src 'self'",
    });
    queueProbes();

    const outcome = await runSecurityCheck("https://example.test/");

    expect(outcome.status).toBe("DOWN");
    expect(outcome.details.failedChecks).toContain("csp");
    expect(outcome.finding.summary.toLowerCase()).toContain("report-only");
  });

  it("requires a sufficiently long HSTS policy for HTTPS", async () => {
    queuePage({ ...SECURE_HEADERS, "strict-transport-security": "max-age=60" });
    queueProbes();

    const outcome = await runSecurityCheck("https://example.test/");

    expect(outcome.status).toBe("DOWN");
    expect(outcome.details.failedChecks).toContain("hsts");
  });

  it("flags an HTTP homepage even when the other baseline headers are present", async () => {
    queuePage();
    queueProbes();

    const outcome = await runSecurityCheck("http://example.test/");

    expect(outcome.status).toBe("DOWN");
    expect(outcome.details.failedChecks).toContain("https");
    expect(outcome.details.pageProtocol).toBe("http:");
  });

  it.each([
    ["env", "DATABASE_URL=postgres://user:secret@db\nAPP_SECRET=top-secret"],
    ["env_production", "APP_SECRET=top-secret"],
    ["git_head", "ref: refs/heads/main\n"],
    ["wp_config", "<?php define('DB_PASSWORD', 'secret');"],
    ["phpinfo", "<title>PHP Version 8.3</title>"],
    ["server_status", "Apache Server Status\nScoreboard"],
  ] as const)("detects a high-confidence exposed %s signature", async (probeId, body) => {
    queuePage();
    SECURITY_PROBE_PATHS.forEach((probe) => {
      requestSafeOutbound.mockResolvedValueOnce(
        response(probe.id === probeId ? 200 : 404, probe.id === probeId ? body : "not found"),
      );
    });

    const outcome = await runSecurityCheck("https://example.test/");
    const serialized = JSON.stringify(outcome);

    expect(outcome.status).toBe("DOWN");
    expect(outcome.healthy).toBe(false);
    expect(outcome.finding).toMatchObject({ ruleId: "monitor.security", severity: "HIGH" });
    expect(outcome.details.exposedCount).toBe(1);
    expect(outcome.details.exposedPaths).toBe(probeId);
    expect(outcome.details.failedChecks).toContain("exposed_configuration");
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("top-secret");
  });

  it("does not flag a custom 404 body or an unrecognised 200 body as exposure", async () => {
    queuePage();
    SECURITY_PROBE_PATHS.forEach((probe, index) => {
      requestSafeOutbound.mockResolvedValueOnce(
        response(index === 0 ? 404 : 200, index === 0 ? "DATABASE_URL=not-real" : "Welcome"),
      );
    });

    const outcome = await runSecurityCheck("https://example.test/");

    expect(outcome.status).toBe("UP");
    expect(outcome.details.exposedCount).toBe(0);
    expect(outcome.details.exposedPaths).toBe("none");
  });

  it("treats 401/403/404 probe responses as protected or absent", async () => {
    queuePage();
    queueProbes([401, 403, 404, 410, 429, 451]);

    const outcome = await runSecurityCheck("https://example.test/");

    expect(outcome.status).toBe("UP");
    expect(outcome.healthy).toBe(true);
    expect(outcome.details.probeErrors).toBe("none");
  });

  it("returns ERROR when a bounded probe cannot be completed and never exposes its error text", async () => {
    queuePage();
    requestSafeOutbound.mockRejectedValueOnce(new Error("internal secret probe details"));
    queueProbes([404, 404, 404, 404, 404]);

    const outcome = await runSecurityCheck("https://example.test/");
    const serialized = JSON.stringify(outcome);

    expect(outcome.status).toBe("ERROR");
    expect(outcome.healthy).toBe(false);
    expect(outcome.details.failedChecks).toContain("probe_transport");
    expect(outcome.errorMessage).toBe(
      "One or more bounded security probes could not be completed.",
    );
    expect(serialized).not.toContain("internal secret probe details");
  });

  it("treats CDN verification pages as incomplete evidence, not exposed files", async () => {
    queuePage();
    SECURITY_PROBE_PATHS.forEach((probe, index) => {
      requestSafeOutbound.mockResolvedValueOnce(
        response(index === 0 ? 200 : 404, index === 0 ? "<title>One moment, please...</title> Please wait while your request is being verified" : ""),
      );
    });

    const outcome = await runSecurityCheck("https://example.test/");

    expect(outcome.status).toBe("ERROR");
    expect(outcome.healthy).toBe(false);
    expect(outcome.details.exposedCount).toBe(0);
    expect(outcome.details.probeErrors).toContain("env");
    expect(JSON.stringify(outcome)).not.toContain("One moment");
  });

  it("returns ERROR and stops on homepage transport failure", async () => {
    requestSafeOutbound.mockRejectedValueOnce(new Error("Outbound request timed out."));

    const outcome = await runSecurityCheck("https://example.test/");

    expect(outcome).toMatchObject({
      status: "ERROR",
      healthy: false,
      errorMessage: "Outbound request timed out.",
      details: { checkType: "SECURITY", failedChecks: "page" },
      finding: { ruleId: "monitor.security", severity: "MEDIUM" },
    });
    expect(requestSafeOutbound).toHaveBeenCalledTimes(1);
  });

  it("stores only header validation flags, never header values", async () => {
    queuePage({
      ...SECURE_HEADERS,
      "content-security-policy": "default-src 'self'; report-uri https://logs.test/secret-token",
      "referrer-policy": "private-policy-token",
    });
    queueProbes();

    const outcome = await runSecurityCheck("https://example.test/");

    expect(outcome.details).toMatchObject({ hsts: 1, csp: 1, referrerPolicy: 1 });
    expect(JSON.stringify(outcome)).not.toContain("private-policy-token");
    expect(JSON.stringify(outcome)).not.toContain("secret-token");
  });

  it("returns ERROR and stops on a homepage redirect", async () => {
    queuePage({}, 301);

    const outcome = await runSecurityCheck("https://example.test/");

    expect(outcome).toMatchObject({
      status: "ERROR",
      healthy: false,
      httpStatusCode: 301,
      details: { checkType: "SECURITY", failedChecks: "page" },
    });
    expect(outcome.finding.summary.toLowerCase()).toContain("redirect");
    expect(requestSafeOutbound).toHaveBeenCalledTimes(1);
  });

  it("returns DOWN and stops on a homepage server failure", async () => {
    queuePage({}, 503, "unavailable");

    const outcome = await runSecurityCheck("https://example.test/");

    expect(outcome).toMatchObject({
      status: "DOWN",
      healthy: false,
      httpStatusCode: 503,
      details: { checkType: "SECURITY", failedChecks: "page" },
    });
    expect(requestSafeOutbound).toHaveBeenCalledTimes(1);
  });

  it("returns a bounded error for an invalid URL without making a request", async () => {
    const outcome = await runSecurityCheck("not-a-url");

    expect(outcome).toMatchObject({
      status: "ERROR",
      healthy: false,
      details: { checkType: "SECURITY", failedChecks: "page" },
      finding: { ruleId: "monitor.security", severity: "MEDIUM" },
    });
    expect(outcome.errorMessage).toContain("invalid");
    expect(requestSafeOutbound).not.toHaveBeenCalled();
  });
});
