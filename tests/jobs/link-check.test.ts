import { beforeEach, describe, expect, it, vi } from "vitest";

const requestSafeOutbound = vi.hoisted(() => vi.fn());
vi.mock("@/lib/security/outbound-url", () => ({ requestSafeOutbound }));

import { extractSameOriginLinks, runLinksCheck } from "@/lib/jobs/link-check";

describe("link monitor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("extracts unique same-origin HTTP links and skips unsafe or external schemes", () => {
    const html = `
      <a href="/pricing">Pricing</a>
      <a href="https://example.com/contact#team">Contact</a>
      <a href="https://other.example/">External</a>
      <a href="javascript:alert(1)">Script</a>
      <a href="mailto:test@example.com">Mail</a>
      <a href="https://user:pass@example.com/private">Credentials</a>
      <a href="/pricing">Duplicate</a>
    `;
    expect(extractSameOriginLinks(html, "https://example.com/home")).toEqual([
      "https://example.com/pricing",
      "https://example.com/contact",
    ]);
  });

  it("reports broken links with bounded evidence", async () => {
    requestSafeOutbound
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<a href="/ok">OK</a><a href="/missing">Missing</a>',
      })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => "" })
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => "" });

    await expect(runLinksCheck("https://example.com")).resolves.toMatchObject({
      status: "DOWN",
      healthy: false,
      httpStatusCode: 200,
      details: { checkType: "LINKS", scannedLinks: 2, brokenLinks: 1 },
      finding: { ruleId: "monitor.links", title: "Broken links detected" },
    });
    expect(requestSafeOutbound).toHaveBeenNthCalledWith(
      2,
      "https://example.com/ok",
      expect.objectContaining({ method: "HEAD", maxBodyBytes: 0 }),
    );
  });

  it("falls back to GET when a link does not support HEAD", async () => {
    requestSafeOutbound
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<a href="/legacy">Legacy</a>',
      })
      .mockResolvedValueOnce({ ok: false, status: 405, text: async () => "" })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => "body" });

    await expect(runLinksCheck("https://example.com")).resolves.toMatchObject({
      status: "UP",
      healthy: true,
      details: { scannedLinks: 1, brokenLinks: 0 },
    });
    expect(requestSafeOutbound).toHaveBeenNthCalledWith(
      3,
      "https://example.com/legacy",
      expect.objectContaining({ method: "GET", maxBodyBytes: 8 * 1024 }),
    );
  });

  it("caps the crawl even when the page contains more links", async () => {
    const html = Array.from({ length: 60 }, (_, index) => `<a href="/page-${index}">x</a>`).join(
      "",
    );
    requestSafeOutbound.mockResolvedValue({ ok: true, status: 200, text: async () => html });

    await expect(runLinksCheck("https://example.com", { maxLinks: 999 })).resolves.toMatchObject({
      details: { scannedLinks: 50, brokenLinks: 0 },
    });
    expect(requestSafeOutbound).toHaveBeenCalledTimes(51);
  });
});
