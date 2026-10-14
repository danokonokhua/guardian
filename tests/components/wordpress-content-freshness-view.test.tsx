// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WordpressIntegrationView } from "@/components/dashboard/wordpress-integration-view";

const ORGANIZATION_ID = "22222222-2222-4222-8222-222222222222";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("WordpressIntegrationView content freshness card", () => {
  it("renders active freshness window and deep link to draft post", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/wordpress")) {
          return {
            ok: true,
            json: async () => ({
              data: {
                plan: "PRO",
                connection: {
                  id: "conn-1",
                  siteUrl: "https://wpblog.example.com",
                  tokenPrefix: "wptok",
                  status: "CONNECTED",
                  wpVersion: "6.6.1",
                  phpVersion: "8.2.0",
                  serverSoftware: "nginx",
                  debugMode: false,
                  httpsEnforced: true,
                  lastSyncAt: "2026-10-14T10:00:00Z",
                  lastError: null,
                  isSandbox: false,
                  contentFreshness: {
                    lastPostDate: "2026-10-01T00:00:00Z",
                    lastPostTitle: "Announcing Our Product Launch",
                    daysSinceLastPost: 13,
                    isStale: false,
                  },
                },
              },
            }),
          };
        }
        if (url.includes("/websites")) {
          return {
            ok: true,
            json: async () => ({
              data: [{ id: "site-1", hostname: "wpblog.example.com", label: "Blog" }],
            }),
          };
        }
        return { ok: false };
      }),
    );

    render(<WordpressIntegrationView organizationId={ORGANIZATION_ID} />);

    await waitFor(() => {
      expect(screen.getByText("Content Freshness & Editorial Cadence")).toBeInTheDocument();
    });

    expect(screen.getByText("✓ Active")).toBeInTheDocument();
    expect(screen.getByText(/"Announcing Our Product Launch"/)).toBeInTheDocument();
    expect(screen.getByText("13 days ago")).toBeInTheDocument();
    expect(screen.getByText(/13 of 60 days/)).toBeInTheDocument();
    expect(screen.getByText(/47 days remaining until alert/)).toBeInTheDocument();

    const draftLink = screen.getByRole("link", { name: "+ Draft Post ↗" });
    expect(draftLink).toHaveAttribute("href", "https://wpblog.example.com/wp-admin/post-new.php");
  });

  it("renders stagnant warning when content is older than 60 days", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/wordpress")) {
          return {
            ok: true,
            json: async () => ({
              data: {
                plan: "PRO",
                connection: {
                  id: "conn-1",
                  siteUrl: "https://wpblog.example.com",
                  tokenPrefix: "wptok",
                  status: "CONNECTED",
                  wpVersion: "6.6.1",
                  phpVersion: "8.2.0",
                  serverSoftware: "nginx",
                  debugMode: false,
                  httpsEnforced: true,
                  lastSyncAt: "2026-10-14T10:00:00Z",
                  lastError: null,
                  isSandbox: false,
                  contentFreshness: {
                    lastPostDate: "2026-07-01T00:00:00Z",
                    lastPostTitle: "Old Summer Update",
                    daysSinceLastPost: 85,
                    isStale: true,
                  },
                },
              },
            }),
          };
        }
        if (url.includes("/websites")) {
          return {
            ok: true,
            json: async () => ({
              data: [{ id: "site-1", hostname: "wpblog.example.com", label: "Blog" }],
            }),
          };
        }
        return { ok: false };
      }),
    );

    render(<WordpressIntegrationView organizationId={ORGANIZATION_ID} />);

    await waitFor(() => {
      expect(screen.getByText("⚠ Stagnant (>60d)")).toBeInTheDocument();
    });

    expect(screen.getByText(/Exceeded cadence by 25d/)).toBeInTheDocument();
  });
});
