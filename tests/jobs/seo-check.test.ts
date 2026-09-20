import { beforeEach, describe, expect, it, vi } from "vitest";

const requestSafeOutbound = vi.hoisted(() => vi.fn());
vi.mock("@/lib/security/outbound-url", () => ({ requestSafeOutbound }));

import { runSeoCheck } from "@/lib/jobs/seo-check";

const completeHomepage = `<!doctype html>
<html>
  <head>
    <title>Guardian example</title>
    <meta name="description" content="A complete description of the example page.">
    <link rel="canonical" href="https://example.com/">
  </head>
  <body><h1>Guardian example</h1></body>
</html>`;

function response(status: number, body = "") {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  };
}

function responseWithHeaders(status: number, body: string, headers: Record<string, string>) {
  return { ...response(status, body), headers };
}

function queueCompleteSite(): void {
  requestSafeOutbound
    .mockResolvedValueOnce(response(200, completeHomepage))
    .mockResolvedValueOnce(response(200, "User-agent: *\nDisallow:"))
    .mockResolvedValueOnce(
      response(
        200,
        '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/</loc></url></urlset>',
      ),
    );
}

describe("basic SEO monitor", () => {
  beforeEach(() => requestSafeOutbound.mockReset());

  it("passes a page with the required on-page, robots, sitemap, and indexability signals", async () => {
    queueCompleteSite();

    const outcome = await runSeoCheck("https://example.com/");

    expect(outcome).toMatchObject({
      status: "UP",
      healthy: true,
      httpStatusCode: 200,
      details: { checkType: "SEO" },
      finding: { ruleId: "monitor.seo", severity: "MEDIUM" },
    });
    expect(outcome.responseTimeMs).toBeGreaterThanOrEqual(0);
    expect(requestSafeOutbound).toHaveBeenCalledTimes(3);
    expect(requestSafeOutbound).toHaveBeenNthCalledWith(
      1,
      "https://example.com/",
      expect.objectContaining({ method: "GET", maxBodyBytes: 512 * 1024 }),
    );
    expect(requestSafeOutbound).toHaveBeenNthCalledWith(
      2,
      "https://example.com/robots.txt",
      expect.objectContaining({ method: "GET" }),
    );
    expect(requestSafeOutbound).toHaveBeenNthCalledWith(
      3,
      "https://example.com/sitemap.xml",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("reports missing title, description, H1, and canonical signals", async () => {
    requestSafeOutbound
      .mockResolvedValueOnce(response(200, "<!doctype html><html><body>Home</body></html>"))
      .mockResolvedValueOnce(response(200, "User-agent: *\nDisallow:"))
      .mockResolvedValueOnce(response(200, '<?xml version="1.0"?><urlset></urlset>'));

    const outcome = await runSeoCheck("https://example.com/");

    expect(outcome).toMatchObject({
      status: "DOWN",
      healthy: false,
      details: { checkType: "SEO" },
      finding: { ruleId: "monitor.seo", severity: "MEDIUM" },
    });
    expect(outcome.finding.summary.toLowerCase()).toContain("title");
    expect(outcome.finding.summary.toLowerCase()).toContain("meta description");
    expect(outcome.finding.summary.toLowerCase()).toContain("h1");
    expect(outcome.finding.summary.toLowerCase()).toContain("canonical");
  });

  it("does not treat data-* attributes as SEO metadata", async () => {
    const misleadingHomepage = `<!doctype html>
      <html><head>
        <title>Guardian example</title>
        <meta data-name="description" data-content="not a description">
        <link data-rel="canonical" data-href="https://example.com/">
      </head><body><h1>Guardian example</h1></body></html>`;
    requestSafeOutbound
      .mockResolvedValueOnce(response(200, misleadingHomepage))
      .mockResolvedValueOnce(response(404, "not found"))
      .mockResolvedValueOnce(response(200, "<urlset></urlset>"));

    const outcome = await runSeoCheck("https://example.com/");

    expect(outcome.status).toBe("DOWN");
    expect(outcome.finding.summary.toLowerCase()).toContain("meta description");
    expect(outcome.finding.summary.toLowerCase()).toContain("canonical");
  });

  it("reports a meta robots noindex directive", async () => {
    const noindexHomepage = completeHomepage.replace(
      "</head>",
      '<meta name="robots" content="noindex,follow"></head>',
    );
    requestSafeOutbound
      .mockResolvedValueOnce(response(200, noindexHomepage))
      .mockResolvedValueOnce(response(200, "User-agent: *\nDisallow:"))
      .mockResolvedValueOnce(response(200, "<urlset></urlset>"));

    const outcome = await runSeoCheck("https://example.com/");

    expect(outcome.status).toBe("DOWN");
    expect(outcome.healthy).toBe(false);
    expect(outcome.finding).toMatchObject({ ruleId: "monitor.seo", severity: "MEDIUM" });
    expect(outcome.finding.summary.toLowerCase()).toContain("noindex");
  });

  it("reports an X-Robots-Tag noindex directive", async () => {
    requestSafeOutbound
      .mockResolvedValueOnce(
        responseWithHeaders(200, completeHomepage, { "x-robots-tag": "noindex, nofollow" }),
      )
      .mockResolvedValueOnce(response(404, "not found"))
      .mockResolvedValueOnce(response(200, "<urlset></urlset>"));

    const outcome = await runSeoCheck("https://example.com/");

    expect(outcome).toMatchObject({
      status: "DOWN",
      healthy: false,
      details: { indexable: 0, xRobotsTag: "noindex, nofollow" },
    });
    expect(outcome.finding.summary.toLowerCase()).toContain("noindex");
  });

  it("reports a site-wide robots disallow directive", async () => {
    requestSafeOutbound
      .mockResolvedValueOnce(response(200, completeHomepage))
      .mockResolvedValueOnce(response(200, "User-agent: *\nDisallow: /"))
      .mockResolvedValueOnce(response(200, "<urlset></urlset>"));

    const outcome = await runSeoCheck("https://example.com/");

    expect(outcome.status).toBe("DOWN");
    expect(outcome.finding).toMatchObject({ ruleId: "monitor.seo", severity: "MEDIUM" });
    expect(outcome.finding.summary.toLowerCase()).toContain("robots.txt");
  });

  it.each([
    [404, "not found", "unavailable"],
    [200, "this is not a sitemap", "invalid"],
  ])("reports a sitemap that is %s or invalid", async (status, body) => {
    requestSafeOutbound
      .mockResolvedValueOnce(response(200, completeHomepage))
      .mockResolvedValueOnce(response(200, "User-agent: *\nDisallow:"))
      .mockResolvedValueOnce(response(status, body));

    const outcome = await runSeoCheck("https://example.com/");

    expect(outcome.status).toBe("DOWN");
    expect(outcome.finding).toMatchObject({ ruleId: "monitor.seo", severity: "MEDIUM" });
    expect(outcome.finding.summary.toLowerCase()).toContain("sitemap");
  });

  it.each([404, 410])(
    "accepts a robots.txt HTTP %s because the default crawl policy still applies",
    async (robotsStatus) => {
      requestSafeOutbound
        .mockResolvedValueOnce(response(200, completeHomepage))
        .mockResolvedValueOnce(response(robotsStatus, "not found"))
        .mockResolvedValueOnce(response(200, "<urlset></urlset>"));

      const outcome = await runSeoCheck("https://example.com/products?ref=monitor");

      expect(outcome.status).toBe("UP");
      expect(outcome.healthy).toBe(true);
      expect(requestSafeOutbound).toHaveBeenCalledTimes(3);
      expect(requestSafeOutbound).toHaveBeenNthCalledWith(
        2,
        "https://example.com/robots.txt",
        expect.any(Object),
      );
      expect(requestSafeOutbound).toHaveBeenNthCalledWith(
        3,
        "https://example.com/sitemap.xml",
        expect.any(Object),
      );
    },
  );

  it("reports a robots transport/server failure while still checking the bounded sitemap URL", async () => {
    requestSafeOutbound
      .mockResolvedValueOnce(response(200, completeHomepage))
      .mockResolvedValueOnce(response(503, "unavailable"))
      .mockResolvedValueOnce(response(200, "<urlset></urlset>"));

    const outcome = await runSeoCheck("https://example.com/");

    expect(outcome.status).toBe("DOWN");
    expect(outcome.healthy).toBe(false);
    expect(outcome.finding).toMatchObject({ ruleId: "monitor.seo", severity: "MEDIUM" });
    expect(outcome.finding.summary.toLowerCase()).toContain("robots.txt");
    expect(requestSafeOutbound).toHaveBeenCalledTimes(3);
  });

  it("uses a same-origin sitemap directive and ignores an external sitemap directive", async () => {
    requestSafeOutbound
      .mockResolvedValueOnce(response(200, completeHomepage))
      .mockResolvedValueOnce(
        response(200, "User-agent: *\nDisallow:\nSitemap: https://other.example/sitemap.xml"),
      )
      .mockResolvedValueOnce(response(200, "<urlset></urlset>"));

    const outcome = await runSeoCheck("https://example.com/");

    expect(outcome.status).toBe("UP");
    expect(requestSafeOutbound).toHaveBeenNthCalledWith(
      3,
      "https://example.com/sitemap.xml",
      expect.any(Object),
    );
    expect(requestSafeOutbound).not.toHaveBeenCalledWith(
      "https://other.example/sitemap.xml",
      expect.any(Object),
    );
  });

  it("returns ERROR and stops when the homepage cannot be fetched", async () => {
    requestSafeOutbound.mockRejectedValueOnce(new Error("Outbound request timed out."));

    const outcome = await runSeoCheck("https://example.com/");

    expect(outcome).toMatchObject({
      status: "ERROR",
      healthy: false,
      errorMessage: "Outbound request timed out.",
      details: { checkType: "SEO" },
      finding: { ruleId: "monitor.seo", severity: "MEDIUM" },
    });
    expect(requestSafeOutbound).toHaveBeenCalledTimes(1);
  });

  it("returns a bounded configuration error for an invalid website URL", async () => {
    const outcome = await runSeoCheck("not-a-url");

    expect(outcome).toMatchObject({
      status: "ERROR",
      healthy: false,
      details: { checkType: "SEO", failedChecks: "page" },
      finding: { ruleId: "monitor.seo", severity: "MEDIUM" },
    });
    expect(outcome.errorMessage).toContain("invalid");
    expect(requestSafeOutbound).not.toHaveBeenCalled();
  });

  it("returns DOWN and stops when the homepage cannot be inspected", async () => {
    requestSafeOutbound.mockResolvedValueOnce(response(503, "unavailable"));

    const outcome = await runSeoCheck("https://example.com/");

    expect(outcome).toMatchObject({
      status: "DOWN",
      healthy: false,
      httpStatusCode: 503,
      details: { checkType: "SEO" },
      finding: { ruleId: "monitor.seo", severity: "MEDIUM" },
    });
    expect(requestSafeOutbound).toHaveBeenCalledTimes(1);
  });

  it("returns ERROR and stops on a homepage redirect because redirects are not followed", async () => {
    requestSafeOutbound.mockResolvedValueOnce(response(301, ""));

    const outcome = await runSeoCheck("https://example.com/");

    expect(outcome).toMatchObject({
      status: "ERROR",
      healthy: false,
      httpStatusCode: 301,
      details: { checkType: "SEO" },
      finding: { ruleId: "monitor.seo", severity: "MEDIUM" },
    });
    expect(outcome.finding.summary.toLowerCase()).toContain("redirect");
    expect(requestSafeOutbound).toHaveBeenCalledTimes(1);
  });
});
