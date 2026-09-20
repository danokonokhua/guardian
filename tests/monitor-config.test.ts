import { describe, expect, it } from "vitest";

import { parseMonitorConfig } from "@/lib/monitor-config";

const websiteId = "11111111-1111-4111-8111-111111111111";

describe("monitor configuration contract", () => {
  it("accepts the monitor types currently implemented by the worker", () => {
    expect(parseMonitorConfig({ websiteId, type: "UPTIME" }).type).toBe("UPTIME");
    expect(parseMonitorConfig({ websiteId, type: "SSL" }).type).toBe("SSL");
    expect(parseMonitorConfig({ websiteId, type: "SECURITY" }).type).toBe("SECURITY");
    expect(parseMonitorConfig({ websiteId, type: "LINKS" }).type).toBe("LINKS");
    expect(parseMonitorConfig({ websiteId, type: "SEO" }).type).toBe("SEO");
    expect(
      parseMonitorConfig({ websiteId, type: "PERFORMANCE", config: { maxResponseTimeMs: 5_000 } })
        .config,
    ).toEqual({ maxResponseTimeMs: 5_000 });
    expect(
      parseMonitorConfig({
        websiteId,
        type: "FORM",
        config: { formId: "contact-form", pagePath: "/contact", probePath: "/api/lead-health" },
      }).config,
    ).toEqual({ formId: "contact-form", pagePath: "/contact", probePath: "/api/lead-health" });
  });

  it("rejects incomplete form monitor configuration", () => {
    expect(() => parseMonitorConfig({ websiteId, type: "FORM" })).toThrow(
      "Request input is invalid.",
    );
  });

  it("rejects unsafe or unbounded performance settings", () => {
    expect(() =>
      parseMonitorConfig({ websiteId, type: "PERFORMANCE", config: { maxResponseTimeMs: 100 } }),
    ).toThrow("Request input is invalid.");
    expect(() =>
      parseMonitorConfig({ websiteId, type: "PERFORMANCE", config: { maxResponseTimeMs: 60_000 } }),
    ).toThrow("Request input is invalid.");
    expect(() =>
      parseMonitorConfig({ websiteId, type: "PERFORMANCE", config: { endpoint: "/admin" } }),
    ).toThrow("Request input is invalid.");
  });

  it("rejects unsafe or incomplete form settings", () => {
    expect(() => parseMonitorConfig({ websiteId, type: "FORM", config: {} })).toThrow(
      "Request input is invalid.",
    );
    expect(() =>
      parseMonitorConfig({ websiteId, type: "FORM", config: { formId: "contact form" } }),
    ).toThrow("Request input is invalid.");
    expect(() =>
      parseMonitorConfig({
        websiteId,
        type: "FORM",
        config: { formId: "contact", pagePath: "//other.test" },
      }),
    ).toThrow("Request input is invalid.");
    expect(() =>
      parseMonitorConfig({
        websiteId,
        type: "FORM",
        config: { formId: "contact", probePath: "/health?x=1" },
      }),
    ).toThrow("Request input is invalid.");
    expect(() =>
      parseMonitorConfig({ websiteId, type: "FORM", config: { formId: "contact", extra: true } }),
    ).toThrow("Request input is invalid.");
  });
});
