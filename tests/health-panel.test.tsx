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
    expect(screen.getByText("UP · HTTP 200 · 120 ms")).toBeInTheDocument();
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

  it("renders the explainable partial score and pending categories", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              healthScore: {
                score: 82,
                state: "PARTIAL",
                coverageWeight: 75,
                totalWeight: 100,
                sourceVersion: "v1",
                calculatedAt: "2026-01-01T00:00:00Z",
                explanation:
                  "Score uses 75% of the available category weight. Pending: reputation.",
                components: [
                  {
                    category: "WEBSITE",
                    label: "Website",
                    weight: 25,
                    score: 100,
                    state: "MEASURED",
                    contribution: 33.33,
                    explanation: "Website scores 100/100 from the latest results (1 UP, 0 DOWN).",
                    evidence: {
                      monitorTypes: ["UPTIME"],
                      monitorIds: ["m1"],
                      resultIds: ["r1"],
                      issueIds: [],
                      issueSeverities: [],
                      upCount: 1,
                      downCount: 0,
                      errorCount: 0,
                      resultCount: 1,
                      monitorCount: 1,
                    },
                    drivers: [],
                  },
                  {
                    category: "REPUTATION",
                    label: "Reputation",
                    weight: 10,
                    score: null,
                    state: "PENDING",
                    contribution: 0,
                    explanation: "Reputation has no monitor result yet.",
                    evidence: {
                      monitorTypes: [],
                      monitorIds: [],
                      resultIds: [],
                      issueIds: [],
                      issueSeverities: [],
                      upCount: 0,
                      downCount: 0,
                      errorCount: 0,
                      resultCount: 0,
                      monitorCount: 0,
                    },
                    drivers: [],
                  },
                ],
              },
              recommendations: [
                {
                  id: "recommendation-1",
                  priority: "HIGH",
                  title: "Homepage availability issue",
                  action: "Review the affected path and restore the failing check.",
                  rationale:
                    "Active HIGH issue: the homepage check failed. Website is currently 40/100.",
                  businessImpact: "Customers may be unable to reach the business.",
                  confidence: 0.82,
                  source: {
                    issueId: "issue-1",
                    ruleId: "monitor.uptime",
                    category: "WEBSITE",
                    componentScore: 40,
                    componentWeight: 25,
                    observedAt: "2026-01-01T00:00:00Z",
                  },
                  evidence: {
                    issueId: "issue-1",
                    issueStatus: "OPEN",
                    issueSeverity: "HIGH",
                    lastSeenAt: "2026-01-01T00:00:00Z",
                    coverageWeight: 75,
                    scoreSourceVersion: "v1",
                  },
                },
              ],
              healthScoreHistory: [
                {
                  id: "score-1",
                  score: 80,
                  state: "PARTIAL",
                  coverageWeight: 75,
                  sourceVersion: "v1",
                  calculatedAt: "2025-12-31T00:00:00Z",
                },
              ],
              summary: {
                monitors: 1,
                up: 1,
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
    expect(await screen.findByText("Digital Health Score")).toBeInTheDocument();
    expect(screen.getByLabelText("Digital health score")).toHaveTextContent("82/100");
    expect(screen.getByText("Partial coverage")).toBeInTheDocument();
    expect(screen.getByText("Reputation")).toBeInTheDocument();
    expect(screen.getByText("Pending", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByLabelText("Digital health score history")).toHaveTextContent("80/100");
    expect(screen.getByText("Recommended next actions")).toBeInTheDocument();
    expect(screen.getByText("Homepage availability issue")).toBeInTheDocument();
    expect(screen.getByText("Evidence-backed")).toBeInTheDocument();
    expect(
      screen.getByText("Review the affected path and restore the failing check."),
    ).toBeInTheDocument();
  });
});
