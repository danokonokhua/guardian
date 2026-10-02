// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DnsEvidence } from "@/components/dashboard/dns-evidence";
afterEach(cleanup);
const latest = Object.fromEntries(
  ["A", "AAAA", "MX", "NS", "TXT"].map((type) => [type, { state: "OK", records: [] as string[] }]),
);
it("explains the waiting state without an acceptance action", () => {
  render(<DnsEvidence onAccept={vi.fn()} />);
  expect(screen.getByText("Waiting for the first DNS check.")).toBeInTheDocument();
  expect(screen.queryByText("Accept displayed baseline")).not.toBeInTheDocument();
});
it("labels additions and removals and enables acceptance for complete changes", () => {
  render(
    <DnsEvidence
      evidence={{
        baseline: { A: ["203.0.113.1"] },
        latest: { ...latest, A: { state: "OK", records: ["203.0.113.2"] } },
        observedAt: "2026-09-27T12:00:00Z",
      }}
      onAccept={vi.fn()}
    />,
  );
  expect(screen.getByText("Added:")).toBeInTheDocument();
  expect(screen.getByText("Removed:")).toBeInTheDocument();
  expect(screen.getByText("Accept displayed baseline")).toBeEnabled();
});
it("blocks acceptance when any observation is unknown", () => {
  render(
    <DnsEvidence
      evidence={{
        baseline: { A: ["203.0.113.1"] },
        latest: { ...latest, A: { state: "UNKNOWN", reason: "ETIMEOUT" } },
        observedAt: "2026-09-27T12:00:00Z",
      }}
      onAccept={vi.fn()}
    />,
  );
  expect(screen.getByText(/Your baseline is preserved/)).toBeInTheDocument();
  expect(screen.getByText("Accept displayed baseline")).toBeDisabled();
  expect(screen.queryByText("Removed:")).not.toBeInTheDocument();
});
