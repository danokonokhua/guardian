// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MonitoringPanel } from "@/app/monitoring-panel";

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("MonitoringPanel", () => {
  it("shows loading while the organization monitor request is pending", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined)),
    );

    render(<MonitoringPanel organizationId={ORGANIZATION_ID} />);

    expect(screen.getByText("Loading monitoring checks…")).toBeInTheDocument();
  });

  it("shows an empty state for an organization without checks", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }))));

    render(<MonitoringPanel organizationId={ORGANIZATION_ID} />);

    expect(await screen.findByText("No monitoring checks configured yet.")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(`/api/v1/organizations/${ORGANIZATION_ID}/monitors`);
  });

  it("renders enabled and paused checks from the tenant-scoped response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "monitor-1",
                websiteId: "website-1",
                type: "UPTIME",
                enabled: true,
                frequencyMinutes: 5,
              },
              {
                id: "monitor-2",
                websiteId: "website-2",
                type: "SSL",
                enabled: false,
                frequencyMinutes: 60,
              },
            ],
          }),
        ),
      ),
    );

    render(<MonitoringPanel organizationId={ORGANIZATION_ID} />);

    expect(await screen.findByText("UPTIME check")).toBeInTheDocument();
    expect(screen.getByText("SSL check")).toBeInTheDocument();
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.getByText("Runs every 5 minutes")).toBeInTheDocument();
  });

  it("shows the request ID when monitor loading fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
          status: 403,
          headers: { "x-request-id": "monitor-request-123" },
        }),
      ),
    );

    render(<MonitoringPanel organizationId={ORGANIZATION_ID} />);

    expect(
      await screen.findByText("Unable to load monitors (request monitor-request-123)"),
    ).toBeInTheDocument();
  });
});
