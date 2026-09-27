// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { it, expect, vi, afterEach } from "vitest";
import { ExecutiveBriefing } from "@/components/dashboard/executive-briefing";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("keeps missing measurements pending instead of reporting a healthy score", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { summary: { activeIssues: 0, monitors: 0 }, recommendations: [] },
        }),
      ),
    ),
  );
  render(<ExecutiveBriefing organizationId="org-1" />);
  expect(await screen.findByText("No evidence-backed actions available")).toBeInTheDocument();
  expect(screen.getAllByText("Pending")).toHaveLength(2);
  expect(screen.queryByText("100/100")).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/api/v1/organizations/org-1/health");
});
