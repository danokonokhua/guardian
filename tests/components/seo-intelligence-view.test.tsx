// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SeoIntelligenceView } from "@/components/dashboard/seo-intelligence-view";

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SeoIntelligenceView Search Console functionality", () => {
  it("renders connected GSC queries and supports client-side keyword search", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            hasAdvancedSeo: true,
            plan: "PRO",
            analysis: null,
            searchConsole: {
              currentClicks: 1250,
              impressions: 45000,
              averageCtrPct: 2.8,
              averagePosition: 8.4,
              topQueries: [
                { query: "uptime monitoring software", clicks: 420, impressions: 8500, position: 2.1 },
                { query: "ssl certificate expiry tracker", clicks: 310, impressions: 7200, position: 3.5 },
                { query: "broken links checker tool", clicks: 80, impressions: 4100, position: 11.2 },
              ],
            },
          },
        }),
      }),
    );

    render(<SeoIntelligenceView organizationId={ORGANIZATION_ID} />);

    await waitFor(() => {
      expect(screen.getByText("Google Organic Rankings & Search Visibility")).toBeInTheDocument();
    });

    expect(screen.getByText("uptime monitoring software")).toBeInTheDocument();
    expect(screen.getByText("ssl certificate expiry tracker")).toBeInTheDocument();
    expect(screen.getByText("broken links checker tool")).toBeInTheDocument();

    // Filter by query "ssl"
    const searchInput = screen.getByPlaceholderText("Filter queries...");
    fireEvent.change(searchInput, { target: { value: "ssl" } });

    expect(screen.getByText("ssl certificate expiry tracker")).toBeInTheDocument();
    expect(screen.queryByText("uptime monitoring software")).not.toBeInTheDocument();
    expect(screen.queryByText("broken links checker tool")).not.toBeInTheDocument();
  });

  it("renders disconnected state card when Search Console is not connected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            hasAdvancedSeo: true,
            plan: "GROWTH",
            analysis: null,
            searchConsole: null,
          },
        }),
      }),
    );

    render(<SeoIntelligenceView organizationId={ORGANIZATION_ID} />);

    await waitFor(() => {
      expect(screen.getByText("Google Search Console Integration")).toBeInTheDocument();
    });

    expect(screen.getByText("Not Connected")).toBeInTheDocument();
    expect(screen.getByText("Connect Search Console ↗")).toBeInTheDocument();
  });
});
