import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveSafeOutboundUrl: vi.fn(),
  runHttpCheck: vi.fn(),
  runPerformanceCheck: vi.fn(),
  runSeoCheck: vi.fn(),
  runSecurityCheck: vi.fn(),
}));

vi.mock("@/lib/security/outbound-url", () => ({
  resolveSafeOutboundUrl: mocks.resolveSafeOutboundUrl,
}));
vi.mock("@/lib/jobs/http-check", () => ({ runHttpCheck: mocks.runHttpCheck }));
vi.mock("@/lib/jobs/performance-check", () => ({
  runPerformanceCheck: mocks.runPerformanceCheck,
}));
vi.mock("@/lib/jobs/seo-check", () => ({ runSeoCheck: mocks.runSeoCheck }));
vi.mock("@/lib/jobs/security-check", () => ({ runSecurityCheck: mocks.runSecurityCheck }));

import { runFreeAudit } from "@/lib/audit/service";

function outcome(status: "UP" | "DOWN" | "ERROR", ruleId: string, severity = "MEDIUM") {
  return {
    status,
    healthy: status === "UP",
    responseTimeMs: 120,
    httpStatusCode: status === "ERROR" ? undefined : 200,
    details: { checkType: ruleId },
    finding: {
      ruleId,
      severity,
      title: `${ruleId} title`,
      summary: `${ruleId} summary`,
    },
  };
}

describe("free audit service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveSafeOutboundUrl.mockResolvedValue({
      url: new URL("https://example.com/"),
      hostname: "example.com",
      address: "93.184.216.34",
      family: 4,
    });
    mocks.runHttpCheck.mockResolvedValue(outcome("UP", "monitor.uptime"));
    mocks.runPerformanceCheck.mockResolvedValue(outcome("UP", "monitor.performance"));
    mocks.runSeoCheck.mockResolvedValue(outcome("DOWN", "monitor.seo", "MEDIUM"));
    mocks.runSecurityCheck.mockResolvedValue(outcome("UP", "monitor.security"));
  });

  it("returns a traceable partial score and only failed findings", async () => {
    const result = await runFreeAudit("https://example.com");

    expect(result.url).toBe("https://example.com/");
    expect(result.score.state).toBe("PARTIAL");
    expect(result.score.coverageWeight).toBe(65);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({ ruleId: "monitor.seo", category: "SEO" });
    expect(result.warnings).toHaveLength(1);
    expect(result.critical).toHaveLength(0);
    expect(result.opportunities[0]).toContain("Connect your verified website");
    const callOrder = [
      mocks.runHttpCheck,
      mocks.runPerformanceCheck,
      mocks.runSeoCheck,
      mocks.runSecurityCheck,
    ].map((adapter) => adapter.mock.invocationCallOrder[0]);
    expect(callOrder).toEqual([...callOrder].sort((left, right) => left! - right!));
  });

  it("never runs an adapter when the SSRF-safe URL boundary rejects the target", async () => {
    mocks.resolveSafeOutboundUrl.mockRejectedValue(new Error("blocked target"));

    await expect(runFreeAudit("http://127.0.0.1")).rejects.toThrow("blocked target");
    expect(mocks.runHttpCheck).not.toHaveBeenCalled();
    expect(mocks.runSecurityCheck).not.toHaveBeenCalled();
  });
});
