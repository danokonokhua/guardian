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

it("renders 5-star rating and unanswered review warning for reputation view", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            recentResults: [],
            issues: [],
            reputationSummary: {
              averageRating: 4.8,
              totalReviewCount: 24,
              unansweredCount: 3,
            },
          },
        }),
      ),
    ),
  );
  render(<MonitoringViewPanel organizationId="org-1" view="reputation" />);
  expect(await screen.findByText("REVIEW HEALTH")).toBeInTheDocument();
  expect(screen.getByLabelText("Rating: 4.8 out of 5 stars")).toBeInTheDocument();
  expect(screen.getByText("4.8")).toBeInTheDocument();
  expect(screen.getByText("/ 5.0")).toBeInTheDocument();
  expect(screen.getByText(/24 verified Google Business reviews/)).toBeInTheDocument();
  expect(screen.getByText(/3 unanswered reviews/)).toBeInTheDocument();
  expect(screen.getByText("Open Reputation Dashboard →")).toBeInTheDocument();
});

it("renders all reviews answered when unansweredCount is 0", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            recentResults: [],
            issues: [],
            reputationSummary: {
              averageRating: 5.0,
              totalReviewCount: 10,
              unansweredCount: 0,
            },
          },
        }),
      ),
    ),
  );
  render(<MonitoringViewPanel organizationId="org-1" view="reputation" />);
  expect(await screen.findByText("REVIEW HEALTH")).toBeInTheDocument();
  expect(screen.getByText("✓ All reviews answered")).toBeInTheDocument();
});

it("renders empty state call to action when no reviews are synced", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            recentResults: [],
            issues: [],
            reputationSummary: null,
          },
        }),
      ),
    ),
  );
  render(<MonitoringViewPanel organizationId="org-1" view="reputation" />);
  expect(await screen.findByText("REVIEW HEALTH")).toBeInTheDocument();
  expect(screen.getByText("No reviews synced")).toBeInTheDocument();
  expect(screen.getByText("Connect Reputation Profile →")).toBeInTheDocument();
});

