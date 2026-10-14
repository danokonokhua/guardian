// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { CompetitorsView } from "@/components/dashboard/competitors-view";

const mockCompetitorData = {
  websiteId: "site-1",
  websiteHostname: "acme.com",
  websiteSpeedMs: 250,
  websiteSeoScore: 88,
  competitorsCount: 2,
  activeOffersCount: 1,
  avgCompetitorSpeedMs: 210,
  competitors: [
    {
      id: "comp-1",
      name: "Fast Rival",
      domain: "fastrival.com",
      targetUrl: "https://fastrival.com",
      status: "ACTIVE",
      lastCheckedAt: "2026-10-14T08:00:00Z",
      latestSnapshot: {
        id: "snap-1",
        snapshotDate: "2026-10-14T08:00:00Z",
        httpStatus: 200,
        responseTimeMs: 180, // faster than 250
        pageTitle: "Fast Rival Inc",
        metaDescription: "Best in class",
        h1: "High Performance Cloud",
        detectedOffer: "50% off autumn discount",
        seoScore: 92,
        hasChanges: true,
        changeSummary: "Updated promo offer",
      },
    },
    {
      id: "comp-2",
      name: "Slow Rival",
      domain: "slowrival.com",
      targetUrl: "https://slowrival.com",
      status: "ACTIVE",
      lastCheckedAt: "2026-10-14T08:00:00Z",
      latestSnapshot: {
        id: "snap-2",
        snapshotDate: "2026-10-14T08:00:00Z",
        httpStatus: 200,
        responseTimeMs: 340, // slower than 250
        pageTitle: "Slow Rival LLC",
        metaDescription: "Standard solutions",
        h1: "Enterprise Infrastructure",
        detectedOffer: null,
        seoScore: 78,
        hasChanges: false,
        changeSummary: null,
      },
    },
  ],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CompetitorsView table features", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/competitors")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                comparison: mockCompetitorData,
              },
            }),
          } as Response);
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      })
    );
  });

  it("renders the table with your site baseline and all competitors", async () => {
    render(<CompetitorsView organizationId="org-1" />);

    await waitFor(() => {
      expect(screen.getByText("Head-to-Head Digital Posture")).toBeInTheDocument();
    });

    const table = screen.getByRole("table");

    // Check baseline row
    expect(within(table).getByText("Your Website")).toBeInTheDocument();
    expect(within(table).getByText("acme.com")).toBeInTheDocument();

    // Check competitor rows
    expect(within(table).getByText("Fast Rival")).toBeInTheDocument();
    expect(within(table).getByText("Slow Rival")).toBeInTheDocument();
    expect(within(table).getByText("180ms")).toBeInTheDocument();
    expect(within(table).getByText("340ms")).toBeInTheDocument();
  });

  it("filters competitors using the filter pills", async () => {
    render(<CompetitorsView organizationId="org-1" />);

    await waitFor(() => {
      expect(screen.getByText("Head-to-Head Digital Posture")).toBeInTheDocument();
    });

    const table = screen.getByRole("table");

    // Both present initially
    expect(within(table).getByText("Fast Rival")).toBeInTheDocument();
    expect(within(table).getByText("Slow Rival")).toBeInTheDocument();

    // Click "⚡ Faster" pill
    const fasterButton = screen.getByRole("button", { name: /⚡ Faster/i });
    fireEvent.click(fasterButton);

    // Fast Rival is faster (180ms < 250ms), Slow Rival is not (340ms > 250ms)
    expect(within(table).getByText("Fast Rival")).toBeInTheDocument();
    expect(within(table).queryByText("Slow Rival")).not.toBeInTheDocument();

    // Click "🏷️ Offers" pill
    const offersButton = screen.getByRole("button", { name: /🏷️ Offers/i });
    fireEvent.click(offersButton);

    // Fast Rival has detectedOffer, Slow Rival does not
    expect(within(table).getByText("Fast Rival")).toBeInTheDocument();
    expect(within(table).queryByText("Slow Rival")).not.toBeInTheDocument();

    // Click "All" pill to restore
    const allButton = screen.getByRole("button", { name: /All \(2\)/i });
    fireEvent.click(allButton);

    expect(within(table).getByText("Fast Rival")).toBeInTheDocument();
    expect(within(table).getByText("Slow Rival")).toBeInTheDocument();
  });

  it("triggers CSV export when clicking Export CSV", async () => {
    const createObjectURLMock = vi.fn().mockReturnValue("blob:mock-url");
    const revokeObjectURLMock = vi.fn();
    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;

    render(<CompetitorsView organizationId="org-1" />);

    await waitFor(() => {
      expect(screen.getByText("Head-to-Head Digital Posture")).toBeInTheDocument();
    });

    const exportBtn = screen.getByRole("button", { name: /Export CSV/i });
    fireEvent.click(exportBtn);

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(1);
  });
});
