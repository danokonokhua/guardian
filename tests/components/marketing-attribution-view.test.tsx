// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { MarketingView } from "@/components/dashboard/marketing-view";

const mockMarketingData = {
  totalSpendCents: 500000,
  totalImpressions: 50000,
  totalClicks: 2500,
  totalConversions: 100,
  totalRevenueCents: 1500000,
  blendedCtrPct: 5.0,
  blendedCpcCents: 200,
  blendedCostPerLeadCents: 5000,
  blendedRoas: 3.0,
  activeCampaignsCount: 3,
  flaggedCampaignsCount: 0,
  channels: [
    {
      channel: "GOOGLE_ADS",
      campaignsCount: 1,
      spendCents: 250000,
      impressions: 25000,
      clicks: 1500,
      conversions: 60,
      revenueCents: 900000,
      costPerLeadCents: 4166,
      ctrPct: 6.0,
      roas: 3.6,
      spendSharePct: 50,
      leadSharePct: 60,
    },
    {
      channel: "META_ADS",
      campaignsCount: 1,
      spendCents: 150000,
      impressions: 20000,
      clicks: 800,
      conversions: 25,
      revenueCents: 450000,
      costPerLeadCents: 6000,
      ctrPct: 4.0,
      roas: 3.0,
      spendSharePct: 30,
      leadSharePct: 25,
    },
    {
      channel: "LINKEDIN_ADS",
      campaignsCount: 1,
      spendCents: 100000,
      impressions: 5000,
      clicks: 200,
      conversions: 15,
      revenueCents: 150000,
      costPerLeadCents: 6666,
      ctrPct: 4.0,
      roas: 1.5,
      spendSharePct: 20,
      leadSharePct: 15,
    },
  ],
  campaigns: [],
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("MarketingView attribution modeling", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/marketing")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                overview: mockMarketingData,
              },
            }),
          } as Response);
        }
        return Promise.reject(new Error(`Unhandled URL: ${url}`));
      })
    );
  });

  it("renders the attribution model switcher and calculates dynamic shares", async () => {
    render(<MarketingView organizationId="org-1" />);

    await waitFor(() => {
      expect(screen.getByText("Multi-Channel Attribution Modeling")).toBeInTheDocument();
    });

    // Default: Last Touch
    expect(screen.getByRole("button", { name: "Last Touch" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "First Touch" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Linear" })).toBeInTheDocument();

    // In Last Touch: Google Ads has 60 leads (60%)
    expect(screen.getByText("60 leads (60%)")).toBeInTheDocument();
    expect(screen.getByText("25 leads (25%)")).toBeInTheDocument();

    // Switch to First Touch
    const firstTouchBtn = screen.getByRole("button", { name: "First Touch" });
    fireEvent.click(firstTouchBtn);

    expect(screen.getByText("First Touch (Discovery)")).toBeInTheDocument();
    // Meta Ads & LinkedIn discovery weight boosts their share compared to last touch
    expect(screen.queryByText("25 leads (25%)")).not.toBeInTheDocument();

    // Switch to Linear Multi-Touch
    const linearBtn = screen.getByRole("button", { name: "Linear" });
    fireEvent.click(linearBtn);

    expect(screen.getByText("Linear Multi-Touch")).toBeInTheDocument();

    // Switch back to Last Touch
    const lastTouchBtn = screen.getByRole("button", { name: "Last Touch" });
    fireEvent.click(lastTouchBtn);

    expect(screen.getByText("60 leads (60%)")).toBeInTheDocument();
    expect(screen.getByText("25 leads (25%)")).toBeInTheDocument();
  });
});
