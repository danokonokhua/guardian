// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WebVitalsTrend, calculatePercentile } from "@/components/dashboard/web-vitals-trend";

afterEach(() => {
  cleanup();
});

describe("WebVitalsTrend component and helpers", () => {
  it("calculates percentiles correctly", () => {
    const numbers = [100, 200, 300, 400, 500];
    expect(calculatePercentile(numbers, 50)).toBe(300);
    expect(calculatePercentile(numbers, 90)).toBe(500);
    expect(calculatePercentile(numbers, 99)).toBe(500);
    expect(calculatePercentile([], 50)).toBe(0);
  });

  it("renders Core Web Vitals compliance badge and metrics", () => {
    const results = [
      { responseTimeMs: 150, checkedAt: "2026-10-14T10:00:00Z", websiteName: "guardian.app" },
      { responseTimeMs: 180, checkedAt: "2026-10-14T10:01:00Z", websiteName: "guardian.app" },
      { responseTimeMs: 210, checkedAt: "2026-10-14T10:02:00Z", websiteName: "guardian.app" },
    ];

    render(<WebVitalsTrend results={results} />);

    expect(screen.getByText("Core Web Vitals & Latency Radar")).toBeInTheDocument();
    expect(screen.getByText("✓ CWV Passing")).toBeInTheDocument();
    expect(screen.getByText("180 ms")).toBeInTheDocument();
  });

  it("switches to Percentiles tab and shows p50, p90, p99", () => {
    const results = [
      { responseTimeMs: 100, checkedAt: "2026-10-14T10:00:00Z", websiteName: "site.com" },
      { responseTimeMs: 250, checkedAt: "2026-10-14T10:01:00Z", websiteName: "site.com" },
      { responseTimeMs: 400, checkedAt: "2026-10-14T10:02:00Z", websiteName: "site.com" },
    ];

    render(<WebVitalsTrend results={results} />);

    const percentilesTab = screen.getByRole("button", { name: "p50 / p90 / p99" });
    fireEvent.click(percentilesTab);

    expect(screen.getByText("p50 (Median)")).toBeInTheDocument();
    expect(screen.getByText("p90 Latency")).toBeInTheDocument();
    expect(screen.getByText("p99 (Tail Peak)")).toBeInTheDocument();
    expect(screen.getAllByText("250 ms").length).toBe(2);
    expect(screen.getAllByText("400 ms").length).toBe(2);
  });

  it("renders empty when no positive response time results are provided", () => {
    const { container } = render(<WebVitalsTrend results={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
