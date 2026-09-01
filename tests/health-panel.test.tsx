// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HealthPanel } from "@/app/health-panel";

const ORG = "11111111-1111-4111-8111-111111111111";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("HealthPanel", () => {
  it("shows loading while health data is pending", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    render(<HealthPanel organizationId={ORG} />);
    expect(screen.getByText("Loading health results…")).toBeInTheDocument();
  });

  it("renders summary, outcomes, incidents, and response history", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              summary: {
                monitors: 1,
                up: 1,
                down: 0,
                error: 0,
                pending: 0,
                activeIssues: 0,
                recoveredIssues: 1,
              },
              recentResults: [
                {
                  id: "r1",
                  status: "UP",
                  checkedAt: "2026-01-01T00:00:00Z",
                  responseTimeMs: 120,
                  httpStatusCode: 200,
                  monitorType: "UPTIME",
                  websiteName: "example.com",
                },
              ],
              issues: [
                {
                  id: "i1",
                  title: "Recovered issue",
                  summary: "Back online",
                  severity: "HIGH",
                  status: "RESOLVED",
                  lastSeenAt: "2026-01-01T00:00:00Z",
                  resolvedAt: "2026-01-01T00:01:00Z",
                  websiteName: "example.com",
                },
              ],
              responseHistory: [
                {
                  checkedAt: "2026-01-01T00:00:00Z",
                  responseTimeMs: 120,
                  websiteName: "example.com",
                },
              ],
            },
          }),
        ),
      ),
    );
    render(<HealthPanel organizationId={ORG} />);
    expect(await screen.findByText("Healthy monitors")).toBeInTheDocument();
    expect(screen.getByText("example.com · UPTIME")).toBeInTheDocument();
    expect(screen.getByText("Recovered")).toBeInTheDocument();
    expect(screen.getByText("120 ms")).toBeInTheDocument();
  });

  it("shows empty states when no results or issues exist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              summary: {
                monitors: 0,
                up: 0,
                down: 0,
                error: 0,
                pending: 0,
                activeIssues: 0,
                recoveredIssues: 0,
              },
              recentResults: [],
              issues: [],
              responseHistory: [],
            },
          }),
        ),
      ),
    );
    render(<HealthPanel organizationId={ORG} />);
    expect(await screen.findByText("No monitor results recorded yet.")).toBeInTheDocument();
    expect(screen.getByText("No incidents detected.")).toBeInTheDocument();
  });

  it("shows request ID on API failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("", {
          status: 500,
          headers: { "x-request-id": "health-request-123" },
        }),
      ),
    );
    render(<HealthPanel organizationId={ORG} />);
    expect(
      await screen.findByText("Unable to load health results (request health-request-123)"),
    ).toBeInTheDocument();
  });
});
