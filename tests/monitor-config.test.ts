import { describe, expect, it } from "vitest";

import { parseMonitorConfig } from "@/lib/monitor-config";

const websiteId = "11111111-1111-4111-8111-111111111111";

describe("monitor configuration contract", () => {
  it("accepts the monitor types currently implemented by the worker", () => {
    expect(parseMonitorConfig({ websiteId, type: "UPTIME" }).type).toBe("UPTIME");
    expect(parseMonitorConfig({ websiteId, type: "SSL" }).type).toBe("SSL");
  });

  it("rejects monitor types whose worker implementation is not available yet", () => {
    expect(() => parseMonitorConfig({ websiteId, type: "SEO" })).toThrow(
      "Request input is invalid.",
    );
  });
});
