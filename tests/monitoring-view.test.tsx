// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import { MonitoringViewPanel } from "@/components/dashboard/monitoring-view";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("keeps SEO results and findings separate from security", async () => {
  const result = (id: string, monitorType: string) => ({
    id,
    monitorType,
    websiteName: id,
    status: "UP",
    checkedAt: "2026-09-27T12:00:00Z",
    httpStatusCode: 200,
    responseTimeMs: 40,
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            recentResults: [result("seo-site", "SEO"), result("security-site", "SECURITY")],
            issues: [
              {
                id: "1",
                ruleId: "monitor.seo",
                status: "OPEN",
                severity: "HIGH",
                title: "Missing title",
                summary: "SEO finding",
              },
              {
                id: "2",
                ruleId: "monitor.security",
                status: "OPEN",
                severity: "HIGH",
                title: "Missing header",
                summary: "Security finding",
              },
            ],
          },
        }),
      ),
    ),
  );
  render(<MonitoringViewPanel organizationId="org-1" view="seo" />);
  expect(await screen.findByText("seo-site")).toBeInTheDocument();
  expect(screen.queryByText("security-site")).not.toBeInTheDocument();
  expect(screen.getByText("Missing title")).toBeInTheDocument();
  expect(screen.queryByText("Missing header")).not.toBeInTheDocument();
});
it("shows absent evidence without claiming a healthy site", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: { recentResults: [], issues: [] } }))),
  );
  render(<MonitoringViewPanel organizationId="org-1" view="revenue" />);
  expect(await screen.findByText("No results available yet")).toBeInTheDocument();
  expect(screen.getByText(/Missing results do not imply/)).toBeInTheDocument();
});
