// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { it, expect, afterEach } from "vitest";
import { BillingOverview } from "@/app/billing/billing-overview";
afterEach(cleanup);
it("shows the real recorded plan without presenting an active paid subscription", () => {
  render(<BillingOverview organizationName="Test organization" plan="PRO" />);
  expect(screen.getByRole("heading", { level: 2, name: "Pro" })).toBeInTheDocument();
  expect(screen.getByText("Billing setup pending")).toBeInTheDocument();
  expect(screen.getAllByText("Pricing not configured")).toHaveLength(6);
  expect(screen.queryByRole("button", { name: /upgrade|pay|checkout/i })).not.toBeInTheDocument();
});
it("does not default a missing plan to Free", () => {
  render(<BillingOverview organizationName="Unavailable" plan={null} />);
  expect(screen.getByRole("heading", { name: "Plan unavailable" })).toBeInTheDocument();
  expect(screen.queryByText("CURRENT PLAN")).not.toBeInTheDocument();
});
