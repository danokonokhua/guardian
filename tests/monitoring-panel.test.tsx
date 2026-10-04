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

    expect(await screen.findByRole("heading", { name: "Website uptime" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "SSL certificate" })).toBeInTheDocument();
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Frequency for Website uptime" })).toHaveValue(5);
    expect(screen.getByRole("spinbutton", { name: "Frequency for SSL certificate" })).toHaveValue(
      60,
    );
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

  it("renders website hostname and category badge on monitor cards instead of raw UUIDs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("/monitors")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                data: [
                  {
                    id: "monitor-domain",
                    websiteId: "site-gabo",
                    type: "DOMAIN_EXPIRY",
                    enabled: true,
                    frequencyMinutes: 1440,
                  },
                ],
              }),
            ),
          );
        }
        if (url.endsWith("/websites")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                data: [
                  {
                    id: "site-gabo",
                    hostname: "gabofarms.com",
                    label: "Gabo Farms",
                    verifyStatus: "VERIFIED",
                  },
                ],
              }),
            ),
          );
        }
        return Promise.reject(new Error(`Unexpected ${url}`));
      }),
    );

    render(<MonitoringPanel organizationId={ORGANIZATION_ID} />);

    // Check that Gabo Farms (gabofarms.com) is displayed prominently in both card and select option
    const siteMatches = await screen.findAllByText("Gabo Farms (gabofarms.com)");
    expect(siteMatches.length).toBeGreaterThanOrEqual(1);
    // Check that SEO & Domain category badge is present
    expect(screen.getAllByText("SEO & Domain").length).toBeGreaterThanOrEqual(1);
    // Check heading for the check
    expect(screen.getByRole("heading", { name: "Domain registration expiry" })).toBeInTheDocument();
  });

  it("surfaces clear backend error message when monitor creation conflicts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: RequestInit) => {
        if (url.endsWith("/monitors") && init?.method === "POST") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                error: {
                  code: "CONFLICT",
                  message: "A monitor of this type already exists for this website.",
                  requestId: "req-conflict-999",
                },
              }),
              { status: 409, headers: { "x-request-id": "req-conflict-999" } },
            ),
          );
        }
        if (url.endsWith("/monitors")) {
          return Promise.resolve(new Response(JSON.stringify({ data: [] })));
        }
        if (url.endsWith("/websites")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                data: [
                  {
                    id: "site-1",
                    hostname: "gabofarms.com",
                    label: "Gabo Farms",
                    verifyStatus: "VERIFIED",
                  },
                ],
              }),
            ),
          );
        }
        return Promise.reject(new Error(`Unexpected ${url}`));
      }),
    );

    render(<MonitoringPanel organizationId={ORGANIZATION_ID} />);

    // Select website and click Add check
    const addButton = await screen.findByRole("button", { name: "Add check" });
    addButton.click();

    expect(
      await screen.findByText("A monitor of this type already exists for this website."),
    ).toBeInTheDocument();
  });
});

