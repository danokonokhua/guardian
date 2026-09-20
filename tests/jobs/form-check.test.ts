import { beforeEach, describe, expect, it, vi } from "vitest";

const performanceNow = vi.hoisted(() => vi.fn());
vi.mock("node:perf_hooks", () => ({ performance: { now: performanceNow } }));

const requestSafeOutbound = vi.hoisted(() => vi.fn());
vi.mock("@/lib/security/outbound-url", () => ({ requestSafeOutbound }));

import { FORM_PAGE_MAX_BODY_BYTES, FORM_TIMEOUT_MS, runFormCheck } from "@/lib/jobs/form-check";

function response(status: number, body = "", text: () => Promise<string> = async () => body) {
  return { ok: status >= 200 && status < 300, status, text };
}

describe("Critical lead form monitor v1", () => {
  beforeEach(() => {
    requestSafeOutbound.mockReset();
    performanceNow.mockReset();
    performanceNow.mockReturnValue(0);
  });

  it("confirms one named server-rendered form without submitting it", async () => {
    performanceNow.mockReturnValueOnce(0).mockReturnValueOnce(125);
    requestSafeOutbound.mockResolvedValue(
      response(200, '<form id="contact-form" method="post" action="/contact"></form>'),
    );

    const outcome = await runFormCheck("https://example.test/", { formId: "contact-form" });

    expect(outcome).toMatchObject({
      status: "UP",
      healthy: true,
      responseTimeMs: 125,
      httpStatusCode: 200,
      details: {
        checkType: "FORM",
        probeMode: "PRESENCE",
        formId: "contact-form",
        formFound: 1,
        method: "POST",
        actionPath: "/contact",
      },
    });
    expect(requestSafeOutbound).toHaveBeenCalledTimes(1);
    expect(requestSafeOutbound).toHaveBeenCalledWith("https://example.test/", {
      method: "GET",
      timeoutMs: FORM_TIMEOUT_MS,
      maxBodyBytes: FORM_PAGE_MAX_BODY_BYTES,
    });
    expect(requestSafeOutbound.mock.calls.some(([, options]) => options?.method === "POST")).toBe(
      false,
    );
    expect(outcome.finding.summary).toContain("does not submit a lead");
  });

  it("matches a form by name and supports a configured same-origin HEAD probe", async () => {
    performanceNow.mockReturnValueOnce(10).mockReturnValueOnce(100).mockReturnValueOnce(240);
    requestSafeOutbound
      .mockResolvedValueOnce(response(200, '<form name="enquiry"></form>'))
      .mockResolvedValueOnce(response(204));

    const outcome = await runFormCheck("https://example.test/", {
      formId: "enquiry",
      pagePath: "/contact",
      probePath: "/api/lead-health",
    });

    expect(outcome).toMatchObject({
      status: "UP",
      healthy: true,
      responseTimeMs: 90,
      details: {
        probeMode: "HEAD",
        pagePath: "/contact",
        probePath: "/api/lead-health",
        probeStatus: 204,
      },
    });
    expect(requestSafeOutbound).toHaveBeenNthCalledWith(1, "https://example.test/contact", {
      method: "GET",
      timeoutMs: FORM_TIMEOUT_MS,
      maxBodyBytes: FORM_PAGE_MAX_BODY_BYTES,
    });
    expect(requestSafeOutbound).toHaveBeenNthCalledWith(2, "https://example.test/api/lead-health", {
      method: "HEAD",
      timeoutMs: FORM_TIMEOUT_MS,
      maxBodyBytes: 0,
    });
  });

  it.each([
    ["form_not_found", "<main>No contact form</main>"],
    ["form_ambiguous", '<form id="contact"></form><form id="contact"></form>'],
  ])("marks %s as DOWN", async (failureClass, html) => {
    performanceNow.mockReturnValueOnce(0).mockReturnValueOnce(10);
    requestSafeOutbound.mockResolvedValue(response(200, html));

    const outcome = await runFormCheck("https://example.test/", { formId: "contact" });

    expect(outcome).toMatchObject({
      status: "DOWN",
      healthy: false,
      details: { failureClass },
      finding: { severity: "CRITICAL", ruleId: "monitor.form" },
    });
  });

  it.each([
    ["external action", '<form id="contact" action="https://other.test/submit"></form>'],
    ["credentialed action", '<form id="contact" action="https://user:pass@example.test/x"></form>'],
    ["javascript action", '<form id="contact" action="javascript:alert(1)"></form>'],
    ["unsupported method", '<form id="contact" method="put"></form>'],
  ])("rejects %s without a probe request", async (_label, html) => {
    performanceNow.mockReturnValueOnce(0).mockReturnValueOnce(10);
    requestSafeOutbound.mockResolvedValue(response(200, html));

    const outcome = await runFormCheck("https://example.test/", { formId: "contact" });

    expect(outcome).toMatchObject({ status: "DOWN", details: { formFound: 1 } });
    expect(requestSafeOutbound).toHaveBeenCalledTimes(1);
  });

  it.each([
    [302, "ERROR", "probe_redirect"],
    [0, "ERROR", "probe_transport"],
    [404, "DOWN", "probe_http_status"],
    [500, "DOWN", "probe_http_status"],
  ] as const)("classifies probe HTTP %s", async (status, expectedStatus, failureClass) => {
    performanceNow.mockReturnValueOnce(0).mockReturnValueOnce(10).mockReturnValueOnce(30);
    requestSafeOutbound
      .mockResolvedValueOnce(response(200, '<form id="contact"></form>'))
      .mockResolvedValueOnce(response(status));

    const outcome = await runFormCheck("https://example.test/", {
      formId: "contact",
      probePath: "/api/lead-health",
    });

    expect(outcome).toMatchObject({ status: expectedStatus, details: { failureClass } });
  });

  it("classifies page redirects and transport failures as incomplete errors", async () => {
    performanceNow.mockReturnValueOnce(0).mockReturnValueOnce(10);
    requestSafeOutbound.mockResolvedValue(response(301));
    await expect(
      runFormCheck("https://example.test/", { formId: "contact" }),
    ).resolves.toMatchObject({
      status: "ERROR",
      details: { failureClass: "page_redirect" },
    });

    performanceNow.mockReset().mockReturnValueOnce(0).mockReturnValueOnce(10);
    requestSafeOutbound.mockRejectedValue(new Error("timed out"));
    await expect(
      runFormCheck("https://example.test/", { formId: "contact" }),
    ).resolves.toMatchObject({
      status: "ERROR",
      details: { failureClass: "page_transport" },
      errorMessage: "timed out",
    });
  });

  it("rejects invalid configuration before making a request", async () => {
    const outcome = await runFormCheck("https://example.test/", {
      formId: "contact form",
      probePath: "https://other.test/health",
    });

    expect(outcome).toMatchObject({
      status: "ERROR",
      details: { failureClass: "invalid_configuration" },
    });
    expect(requestSafeOutbound).not.toHaveBeenCalled();

    requestSafeOutbound.mockReset();
    const extraKey = await runFormCheck("https://example.test/", {
      formId: "contact",
      unexpected: true,
    });
    expect(extraKey).toMatchObject({
      status: "ERROR",
      details: { failureClass: "invalid_configuration" },
    });
    expect(requestSafeOutbound).not.toHaveBeenCalled();
  });

  it("does not expose bounded response bodies in outcome evidence", async () => {
    const secret = "lead-email=person@example.test";
    performanceNow.mockReturnValueOnce(0).mockReturnValueOnce(10);
    requestSafeOutbound.mockResolvedValue(response(200, `<form id="contact">${secret}</form>`));

    const outcome = await runFormCheck("https://example.test/", { formId: "missing" });

    expect(JSON.stringify(outcome)).not.toContain(secret);
  });
});
